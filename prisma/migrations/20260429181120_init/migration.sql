-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "division" TEXT NOT NULL,
    "conference" TEXT NOT NULL,
    "cbbdTeamId" INTEGER,
    "cbbdName" TEXT,
    "sidearmId" TEXT,
    "masseyName" TEXT,
    "logoUrl" TEXT,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerSeason" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "division" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "games" INTEGER NOT NULL,
    "gamesStarted" INTEGER,
    "minutesPlayed" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "assists" INTEGER NOT NULL,
    "totalRebounds" INTEGER NOT NULL,
    "offRebounds" INTEGER NOT NULL,
    "defRebounds" INTEGER NOT NULL,
    "steals" INTEGER NOT NULL,
    "blocks" INTEGER NOT NULL,
    "turnovers" INTEGER NOT NULL,
    "fgMade" INTEGER NOT NULL,
    "fgAttempted" INTEGER NOT NULL,
    "threeMade" INTEGER NOT NULL,
    "threeAttempted" INTEGER NOT NULL,
    "ftMade" INTEGER NOT NULL,
    "ftAttempted" INTEGER NOT NULL,
    "position" TEXT,
    "tRankPid" INTEGER,
    "tRankPositionRole" TEXT,
    "tRankYr" TEXT,
    "tRankHt" TEXT,
    "tRankUsg" DOUBLE PRECISION,
    "tRankOrtg" DOUBLE PRECISION,
    "tRankDrtg" DOUBLE PRECISION,
    "tRankBpm" DOUBLE PRECISION,
    "tRankObpm" DOUBLE PRECISION,
    "tRankDbpm" DOUBLE PRECISION,
    "eligibilityYear" TEXT,

    CONSTRAINT "PlayerSeason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamSeason" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "division" TEXT NOT NULL,
    "conference" TEXT NOT NULL,
    "wins" INTEGER NOT NULL,
    "losses" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "ppg" DOUBLE PRECISION,
    "oppPpg" DOUBLE PRECISION,
    "fgPct" DOUBLE PRECISION,
    "threePct" DOUBLE PRECISION,
    "ftPct" DOUBLE PRECISION,
    "oppFgPct" DOUBLE PRECISION,
    "oppThreePct" DOUBLE PRECISION,
    "apg" DOUBLE PRECISION,
    "topg" DOUBLE PRECISION,
    "spg" DOUBLE PRECISION,
    "bpg" DOUBLE PRECISION,
    "orbpg" DOUBLE PRECISION,
    "drbpg" DOUBLE PRECISION,
    "oppTopg" DOUBLE PRECISION,

    CONSTRAINT "TeamSeason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RatingsEntry" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "rank" INTEGER,
    "rating" DOUBLE PRECISION,
    "offRating" DOUBLE PRECISION,
    "defRating" DOUBLE PRECISION,
    "conference" TEXT NOT NULL,
    "source" TEXT NOT NULL,

    CONSTRAINT "RatingsEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasseyEntry" (
    "id" TEXT NOT NULL,
    "teamId" TEXT,
    "teamName" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL,
    "losses" INTEGER NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "conference" TEXT NOT NULL,

    CONSTRAINT "MasseyEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coach" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "division" TEXT NOT NULL,

    CONSTRAINT "Coach_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportLog" (
    "id" TEXT NOT NULL,
    "importType" TEXT NOT NULL,
    "year" INTEGER,
    "division" TEXT,
    "teamId" TEXT,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "rowsAffected" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlayerSeason_teamId_year_idx" ON "PlayerSeason"("teamId", "year");

-- CreateIndex
CREATE INDEX "PlayerSeason_playerId_idx" ON "PlayerSeason"("playerId");

-- CreateIndex
CREATE INDEX "PlayerSeason_year_division_idx" ON "PlayerSeason"("year", "division");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerSeason_playerId_teamId_year_key" ON "PlayerSeason"("playerId", "teamId", "year");

-- CreateIndex
CREATE INDEX "TeamSeason_teamId_idx" ON "TeamSeason"("teamId");

-- CreateIndex
CREATE INDEX "TeamSeason_year_division_idx" ON "TeamSeason"("year", "division");

-- CreateIndex
CREATE UNIQUE INDEX "TeamSeason_teamId_year_key" ON "TeamSeason"("teamId", "year");

-- CreateIndex
CREATE INDEX "RatingsEntry_year_idx" ON "RatingsEntry"("year");

-- CreateIndex
CREATE UNIQUE INDEX "RatingsEntry_teamId_year_key" ON "RatingsEntry"("teamId", "year");

-- CreateIndex
CREATE INDEX "MasseyEntry_year_idx" ON "MasseyEntry"("year");

-- CreateIndex
CREATE INDEX "MasseyEntry_teamId_year_idx" ON "MasseyEntry"("teamId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "Coach_teamId_year_key" ON "Coach"("teamId", "year");

-- CreateIndex
CREATE INDEX "ImportLog_importType_year_idx" ON "ImportLog"("importType", "year");

-- AddForeignKey
ALTER TABLE "PlayerSeason" ADD CONSTRAINT "PlayerSeason_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamSeason" ADD CONSTRAINT "TeamSeason_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatingsEntry" ADD CONSTRAINT "RatingsEntry_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasseyEntry" ADD CONSTRAINT "MasseyEntry_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coach" ADD CONSTRAINT "Coach_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
