/**
 * ParkSmart Traffic Simulation Script
 * Simulates entry/exit vehicle scans, barrier triggers, and manual tallies.
 */

async function main() {
  console.log("🚗 Starting ParkSmart Traffic Simulator...");
  console.log("Simulating ANPR entry scan...");
  
  const sampleEvents = [
    { type: "ENTRY", plate: "KA01HH1234", parkingAreaId: "area_downton_01" },
    { type: "TALLY_INCREMENT", count: 1, parkingAreaId: "area_stadium_02" },
    { type: "EXIT", plate: "KA01HH1234", parkingAreaId: "area_downton_01" },
  ];

  for (const event of sampleEvents) {
    console.log(`[EVENT] ${event.type}:`, JSON.stringify(event));
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log("✅ Simulation batch complete.");
}

main().catch(console.error);
