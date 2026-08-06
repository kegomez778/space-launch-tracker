-- CreateTable
CREATE TABLE "countries" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "code3" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameOfficial" TEXT NOT NULL,
    "nameNormalized" TEXT NOT NULL,
    "flagSvg" TEXT,
    "flagPng" TEXT,
    "flagAlt" TEXT,
    "region" TEXT,
    "subregion" TEXT,
    "capital" TEXT,
    "latitude" REAL,
    "longitude" REAL
);

-- CreateTable
CREATE TABLE "country_aliases" (
    "aliasNormalized" TEXT NOT NULL PRIMARY KEY,
    "countryCode" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    CONSTRAINT "country_aliases_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "countries" ("code") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "rockets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL,
    "stages" INTEGER NOT NULL,
    "firstFlight" TEXT,
    "heightM" REAL,
    "massKg" REAL,
    "description" TEXT
);

-- CreateTable
CREATE TABLE "launchpads" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "locality" TEXT,
    "region" TEXT,
    "timezone" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "status" TEXT,
    "countryCode" TEXT,
    CONSTRAINT "launchpads_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "countries" ("code") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "launches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "flightNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "nameNormalized" TEXT NOT NULL,
    "dateUtc" DATETIME NOT NULL,
    "datePrecision" TEXT NOT NULL,
    "isProvisional" BOOLEAN NOT NULL DEFAULT false,
    "success" BOOLEAN,
    "failureReason" TEXT,
    "details" TEXT,
    "patchSmall" TEXT,
    "patchLarge" TEXT,
    "webcast" TEXT,
    "wikipedia" TEXT,
    "article" TEXT,
    "sourceUpcoming" BOOLEAN NOT NULL,
    "rocketId" TEXT,
    "launchpadId" TEXT,
    CONSTRAINT "launches_rocketId_fkey" FOREIGN KEY ("rocketId") REFERENCES "rockets" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "launches_launchpadId_fkey" FOREIGN KEY ("launchpadId") REFERENCES "launchpads" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "payloads" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "launchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "massKg" REAL,
    "orbit" TEXT,
    "customers" TEXT NOT NULL DEFAULT '[]',
    "manufacturers" TEXT NOT NULL DEFAULT '[]',
    CONSTRAINT "payloads_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "launches" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "payload_nationalities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "payloadId" TEXT NOT NULL,
    "rawValue" TEXT NOT NULL,
    "resolution" TEXT NOT NULL,
    "method" TEXT,
    "countryCode" TEXT,
    CONSTRAINT "payload_nationalities_payloadId_fkey" FOREIGN KEY ("payloadId") REFERENCES "payloads" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "payload_nationalities_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "countries" ("code") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "launch_countries" (
    "launchId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "relation" TEXT NOT NULL,

    PRIMARY KEY ("launchId", "countryCode", "relation"),
    CONSTRAINT "launch_countries_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "launches" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "launch_countries_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "countries" ("code") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "emailNormalized" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "countryCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "countries" ("code") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "follows" (
    "userId" TEXT NOT NULL,
    "launchId" TEXT NOT NULL,
    "followedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "launchId"),
    CONSTRAINT "follows_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "follows_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "launches" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sync_runs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "resource" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "recordsProcessed" INTEGER NOT NULL DEFAULT 0,
    "recordsRejected" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT
);

-- CreateIndex
CREATE INDEX "countries_nameNormalized_idx" ON "countries"("nameNormalized");

-- CreateIndex
CREATE INDEX "country_aliases_countryCode_idx" ON "country_aliases"("countryCode");

-- CreateIndex
CREATE INDEX "launchpads_countryCode_idx" ON "launchpads"("countryCode");

-- CreateIndex
CREATE INDEX "launches_dateUtc_idx" ON "launches"("dateUtc");

-- CreateIndex
CREATE INDEX "launches_nameNormalized_idx" ON "launches"("nameNormalized");

-- CreateIndex
CREATE INDEX "launches_rocketId_idx" ON "launches"("rocketId");

-- CreateIndex
CREATE INDEX "payloads_launchId_idx" ON "payloads"("launchId");

-- CreateIndex
CREATE INDEX "payload_nationalities_payloadId_idx" ON "payload_nationalities"("payloadId");

-- CreateIndex
CREATE INDEX "payload_nationalities_countryCode_idx" ON "payload_nationalities"("countryCode");

-- CreateIndex
CREATE INDEX "payload_nationalities_resolution_idx" ON "payload_nationalities"("resolution");

-- CreateIndex
CREATE INDEX "launch_countries_countryCode_launchId_idx" ON "launch_countries"("countryCode", "launchId");

-- CreateIndex
CREATE UNIQUE INDEX "users_emailNormalized_key" ON "users"("emailNormalized");

-- CreateIndex
CREATE INDEX "follows_userId_idx" ON "follows"("userId");

-- CreateIndex
CREATE INDEX "sync_runs_resource_startedAt_idx" ON "sync_runs"("resource", "startedAt");
