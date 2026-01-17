import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.findFirst({
    where: { name: "Alice Nguyen" }
  })
  
  if (!user) {
    console.log("User not found")
    return
  }
  
  console.log("User:", user.name, user.id)
  
  const goals = await prisma.goal.findMany({
    where: { ownerId: user.id },
    select: { id: true, name: true, active: true, cadenceType: true, dailyTarget: true, weeklyTarget: true, createdAt: true }
  })
  
  console.log("\nGoals:")
  for (const g of goals) {
    console.log(`  ${g.name}: active=${g.active}, type=${g.cadenceType}, dailyTarget=${g.dailyTarget}, created=${g.createdAt}`)
  }
  
  const checkIns = await prisma.checkIn.findMany({
    where: { userId: user.id },
    include: { goal: { select: { name: true, active: true } } }
  })
  
  console.log("\nCheck-ins:")
  for (const ci of checkIns) {
    console.log(`  ${ci.localDateKey} (${ci.weekKey}): goal=${ci.goal.name}, active=${ci.goal.active}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
