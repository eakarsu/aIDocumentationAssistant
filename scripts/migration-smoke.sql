CREATE TABLE "User" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL
);

CREATE TABLE "Repository" (
  "id" TEXT PRIMARY KEY,
  "provider" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "createdById" TEXT NOT NULL
);
CREATE UNIQUE INDEX "Repository_provider_fullName_key" ON "Repository"("provider", "fullName");

CREATE TABLE "ParsedCodeFile" (
  "id" TEXT PRIMARY KEY,
  "repositoryId" TEXT NOT NULL,
  "filePath" TEXT NOT NULL
);

CREATE TABLE "WebhookEvent" (
  "id" TEXT PRIMARY KEY,
  "repositoryId" TEXT NOT NULL
);

INSERT INTO "User" ("id", "email", "firstName", "lastName")
VALUES ('existing-user', 'existing@example.test', 'Existing', 'User');
INSERT INTO "Repository" ("id", "provider", "fullName", "createdById")
VALUES ('existing-repository', 'GITHUB', 'example/repository', 'existing-user');
INSERT INTO "ParsedCodeFile" ("id", "repositoryId", "filePath")
VALUES ('existing-file', 'existing-repository', 'README.md');
INSERT INTO "WebhookEvent" ("id", "repositoryId")
VALUES ('existing-webhook', 'existing-repository');
