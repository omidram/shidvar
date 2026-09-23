export async function GET() {
  return Response.json({
    success: true,
    data: { status: "ok", service: "shidvar", time: new Date().toISOString() },
  });
}
