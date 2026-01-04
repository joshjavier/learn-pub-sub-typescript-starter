import amqp from "amqplib";

async function main() {
  console.log("Starting Peril server...");
  const url = "amqp://guest:guest@localhost:5672/";
  const conn = await amqp.connect(url);
  console.log("Connected to RabbitMQ server.");

  process.on("SIGINT", async () => {
    console.log("Shutting down...");
    await conn.close();
    process.exit(130);
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
