export class FantasyTeam {
    // TODO: define roster, owner info, scoring, etc.
    private ownerId: string;

    private leagueId: string;

    private draftId: string;

    // https://sleepercdn.com/avatars/thumbs/<avatar_id>
    private avatarId: string;

    // TODO: narrow object type
    private leagueSettings: Record<string, unknown>;

    // TODO: confirm object type
    private scoringSettings: Record<string, number>;

    private rosterPositions: string[];

    private teamStats: Record<string, number>;

    private seasonYear: string;

    private players: string[];

    /** ID of team within league. */
    private rosterId: number;

    constructor(
        ownerId: string,
        leagueId: string,
        draftId: string,
        avatarId: string,
        leagueSettings: Record<string, unknown>,
        scoringSettings: Record<string, number>,
        rosterPositions: string[],
        teamStats: Record<string, number>,
        seasonYear: string,
        players: string[],
        rosterId: number
    ) {
        this.ownerId = ownerId;
        this.leagueId = leagueId;
        this.draftId = draftId;
        this.avatarId = avatarId;
        this.leagueSettings = leagueSettings;
        this.scoringSettings = scoringSettings;
        this.rosterPositions = rosterPositions;
        this.teamStats = teamStats;
        this.seasonYear = seasonYear;
        this.players = players;
        this.rosterId = rosterId;
    }

    public getOwnerId(): string {
        return this.ownerId;
    }

    public getLeagueId(): string {
        return this.leagueId;
    }

    public getDraftId(): string {
        return this.draftId;
    }

    public getAvatarId(): string {
        return this.avatarId;
    }

    public getLeagueSettings(): Record<string, unknown> {
        return this.leagueSettings;
    }

    public getScoringSettings(): Record<string, number> {
        return this.scoringSettings;
    }

    public getRosterPositions(): string[] {
        return this.rosterPositions;
    }

    public getTeamStats(): Record<string, number> {
        return this.teamStats;
    }

    public getSeasonYear(): string {
        return this.seasonYear;
    }

    public getPlayers(): string[] {
        return this.players;
    }

    public getRosterId(): number {
        return this.rosterId;
    }
}
