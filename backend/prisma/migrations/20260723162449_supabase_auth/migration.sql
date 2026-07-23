/*
  Warnings:

  - You are about to drop the column `passwordHash` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `ActionToken` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `OAuthAccount` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RefreshToken` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ActionToken" DROP CONSTRAINT "ActionToken_userId_fkey";

-- DropForeignKey
ALTER TABLE "OAuthAccount" DROP CONSTRAINT "OAuthAccount_userId_fkey";

-- DropForeignKey
ALTER TABLE "RefreshToken" DROP CONSTRAINT "RefreshToken_userId_fkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "passwordHash";

-- DropTable
DROP TABLE "ActionToken";

-- DropTable
DROP TABLE "OAuthAccount";

-- DropTable
DROP TABLE "RefreshToken";
