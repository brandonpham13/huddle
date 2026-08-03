import { type Express, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import { requireAuth } from "../middleware/requireAuth.js";
import { HuddlesServiceError } from "../services/huddlesService.js";
import {
  listSurveys,
  getSurveyForFill,
  createSurvey,
  updateSurvey,
  submitResponse,
  getResults,
  setResultsPublished,
  deleteSurvey,
  type NewSurveyInput,
  type NewSurveyQuestionInput,
  type SurveyAnswerInput,
  type SurveyQuestionType,
  type SurveyAnonymity,
} from "../services/surveyService.js";

const QUESTION_TYPES = new Set<SurveyQuestionType>([
  "short_text",
  "paragraph",
  "multiple_choice",
  "checkboxes",
]);

const ANONYMITY_VALUES = new Set<SurveyAnonymity>(["none", "anonymous_to_league", "anonymous_to_all"]);

function handleError(err: unknown, res: Response): void {
  if (err instanceof HuddlesServiceError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error("surveyRoutes error:", err);
  res.status(500).json({ error: "Internal error" });
}

function parseNewSurveyInput(body: unknown): NewSurveyInput | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;

  const title = typeof b["title"] === "string" ? b["title"] : "";
  const description = typeof b["description"] === "string" ? b["description"] : null;
  const closesAt = typeof b["closesAt"] === "string" ? b["closesAt"] : "";
  const anonymity =
    typeof b["anonymity"] === "string" && ANONYMITY_VALUES.has(b["anonymity"] as SurveyAnonymity)
      ? (b["anonymity"] as SurveyAnonymity)
      : "none";
  const autoPublishOnClose = b["autoPublishOnClose"] === true;
  if (!Array.isArray(b["questions"])) return null;

  const questions: NewSurveyQuestionInput[] = [];
  for (const raw of b["questions"]) {
    if (typeof raw !== "object" || raw === null) return null;
    const q = raw as Record<string, unknown>;
    const type = q["type"];
    if (typeof type !== "string" || !QUESTION_TYPES.has(type as SurveyQuestionType)) return null;
    const id = typeof q["id"] === "string" ? q["id"] : undefined;
    const prompt = typeof q["prompt"] === "string" ? q["prompt"] : "";
    const required = q["required"] !== false;
    const options = Array.isArray(q["options"])
      ? q["options"].filter((o): o is string => typeof o === "string")
      : [];
    questions.push({ id, type: type as SurveyQuestionType, prompt, required, options });
  }

  return { title, description, closesAt, anonymity, autoPublishOnClose, questions };
}

function parseAnswers(body: unknown): SurveyAnswerInput[] | null {
  if (typeof body !== "object" || body === null) return null;
  const { answers } = body as { answers?: unknown };
  if (!Array.isArray(answers)) return null;

  const parsed: SurveyAnswerInput[] = [];
  for (const raw of answers) {
    if (typeof raw !== "object" || raw === null) return null;
    const a = raw as Record<string, unknown>;
    if (typeof a["questionId"] !== "string") return null;
    const textValue = typeof a["textValue"] === "string" ? a["textValue"] : undefined;
    const optionIds = Array.isArray(a["optionIds"])
      ? a["optionIds"].filter((id): id is string => typeof id === "string")
      : undefined;
    parsed.push({ questionId: a["questionId"], textValue, optionIds });
  }
  return parsed;
}

export function initSurveyRoutes(app: Express) {
  // GET /api/huddles/:id/surveys — any authenticated member
  app.get("/api/huddles/:id/surveys", requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId } = getAuth(req);
      const surveys = await listSurveys(req.params.id!, userId!);
      res.json({ surveys });
    } catch (err) {
      handleError(err, res);
    }
  });

  // POST /api/huddles/:id/surveys — commissioner only
  app.post("/api/huddles/:id/surveys", requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId } = getAuth(req);
      const input = parseNewSurveyInput(req.body);
      if (!input) {
        res.status(400).json({ error: "title, closesAt, and questions are required" });
        return;
      }
      const survey = await createSurvey({ huddleId: req.params.id!, userId: userId!, input });
      res.status(201).json({ survey });
    } catch (err) {
      handleError(err, res);
    }
  });

  // GET /api/huddles/:id/surveys/:surveyId — any authenticated member
  app.get("/api/huddles/:id/surveys/:surveyId", requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId } = getAuth(req);
      const survey = await getSurveyForFill(req.params.id!, req.params.surveyId!, userId!);
      if (!survey) {
        res.status(404).json({ error: "Survey not found" });
        return;
      }
      res.json({ survey });
    } catch (err) {
      handleError(err, res);
    }
  });

  // PUT /api/huddles/:id/surveys/:surveyId — replace title/description/closesAt/questions — commissioner only
  app.put("/api/huddles/:id/surveys/:surveyId", requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId } = getAuth(req);
      const input = parseNewSurveyInput(req.body);
      if (!input) {
        res.status(400).json({ error: "title, closesAt, and questions are required" });
        return;
      }
      const survey = await updateSurvey({
        huddleId: req.params.id!,
        surveyId: req.params.surveyId!,
        userId: userId!,
        input,
      });
      res.json({ survey });
    } catch (err) {
      handleError(err, res);
    }
  });

  // POST /api/huddles/:id/surveys/:surveyId/responses — approved members only, before closesAt
  app.post(
    "/api/huddles/:id/surveys/:surveyId/responses",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { userId } = getAuth(req);
        const answers = parseAnswers(req.body);
        if (!answers) {
          res.status(400).json({ error: "answers (array) required" });
          return;
        }
        const survey = await submitResponse({
          huddleId: req.params.id!,
          surveyId: req.params.surveyId!,
          userId: userId!,
          answers,
        });
        res.json({ survey });
      } catch (err) {
        handleError(err, res);
      }
    },
  );

  // GET /api/huddles/:id/surveys/:surveyId/results — commissioner, or member once published
  app.get(
    "/api/huddles/:id/surveys/:surveyId/results",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { userId } = getAuth(req);
        const results = await getResults(req.params.id!, req.params.surveyId!, userId!);
        res.json({ results });
      } catch (err) {
        handleError(err, res);
      }
    },
  );

  // PATCH /api/huddles/:id/surveys/:surveyId — { resultsPublished } — commissioner only
  app.patch("/api/huddles/:id/surveys/:surveyId", requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId } = getAuth(req);
      const { resultsPublished } = req.body as { resultsPublished?: unknown };
      if (typeof resultsPublished !== "boolean") {
        res.status(400).json({ error: "resultsPublished (boolean) required" });
        return;
      }
      await setResultsPublished(req.params.id!, req.params.surveyId!, userId!, resultsPublished);
      res.status(204).end();
    } catch (err) {
      handleError(err, res);
    }
  });

  // DELETE /api/huddles/:id/surveys/:surveyId — commissioner only
  app.delete("/api/huddles/:id/surveys/:surveyId", requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId } = getAuth(req);
      await deleteSurvey(req.params.id!, req.params.surveyId!, userId!);
      res.status(204).end();
    } catch (err) {
      handleError(err, res);
    }
  });
}
