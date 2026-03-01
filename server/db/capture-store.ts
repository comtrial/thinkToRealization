import prisma from "./prisma";

export async function saveLog(
  sessionId: string,
  role: string,
  content: string,
  rawLength: number
): Promise<void> {
  try {
    await prisma.terminalLog.create({
      data: {
        sessionId,
        role,
        content,
        rawLength,
      },
    });
  } catch (err) {
    // DB capture failure should not crash the terminal session
    console.error("[capture-store] Failed to save log:", err);
  }
}
