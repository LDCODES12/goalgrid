import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      pointsLifetimeMilli: true,
      pointsWeekMilli: true,
      pointsWeekKey: true,
      _count: {
        select: {
          checkIns: true,
          ledgerEntries: true,
        }
      }
    }
  })

  console.log("User Points Status:")
  console.log("===================")
  for (const user of users) {
    console.log(`${user.name}:`)
    console.log(`  Lifetime: ${Math.floor(user.pointsLifetimeMilli / 1000)} pts`)
    console.log(`  This Week: ${Math.floor(user.pointsWeekMilli / 1000)} pts (${user.pointsWeekKey ?? 'N/A'})`)
    console.log(`  Check-ins: ${user._count.checkIns}`)
    console.log(`  Ledger entries: ${user._count.ledgerEntries}`)
    console.log(`  Needs backfill: ${user._count.checkIns > 0 && user._count.ledgerEntries === 0 ? 'YES' : 'no'}`)
    console.log()
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
