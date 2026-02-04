import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";

dotenv.config();

const sql = neon(process.env.DATABASE_URL);

async function testApplicationFlow() {
  console.log("=== Testing Application Flow ===\n");

  try {
    // 1. Check if job_applications table exists
    console.log("1. Checking job_applications table...");
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'job_applications'
      );
    `;
    console.log("   ✓ Table exists:", tableCheck[0].exists);

    // 2. Get all applications
    console.log("\n2. Fetching all applications...");
    const allApps = await sql`
      SELECT 
        a.*,
        sr.service_type,
        sr.clerk_id as job_owner_clerk_id
      FROM job_applications a
      JOIN service_request sr ON a.job_id = sr.id
      ORDER BY a.created_at DESC;
    `;
    console.log(`   ✓ Total applications: ${allApps.length}`);
    
    if (allApps.length > 0) {
      console.log("\n   Sample applications:");
      allApps.slice(0, 3).forEach((app, i) => {
        console.log(`   ${i + 1}. Application #${app.id}`);
        console.log(`      - Job: ${app.service_type} (ID: ${app.job_id})`);
        console.log(`      - Freelancer: ${app.freelancer_name} (${app.freelancer_clerk_id})`);
        console.log(`      - Status: ${app.status}`);
        console.log(`      - Job Owner: ${app.job_owner_clerk_id}`);
        console.log(`      - Created: ${app.created_at}`);
      });
    }

    // 3. Get applications grouped by job
    console.log("\n3. Applications by job:");
    const appsByJob = await sql`
      SELECT 
        sr.id as job_id,
        sr.service_type,
        sr.clerk_id as owner_clerk_id,
        COUNT(a.id) as application_count
      FROM service_request sr
      LEFT JOIN job_applications a ON sr.id = a.job_id
      GROUP BY sr.id, sr.service_type, sr.clerk_id
      HAVING COUNT(a.id) > 0
      ORDER BY COUNT(a.id) DESC;
    `;
    
    if (appsByJob.length > 0) {
      appsByJob.forEach((job, i) => {
        console.log(`   ${i + 1}. Job #${job.job_id}: "${job.service_type}"`);
        console.log(`      - Owner: ${job.owner_clerk_id}`);
        console.log(`      - Applications: ${job.application_count}`);
      });
    } else {
      console.log("   No jobs have applications yet");
    }

    // 4. Get applications by status
    console.log("\n4. Applications by status:");
    const statusCounts = await sql`
      SELECT status, COUNT(*) as count
      FROM job_applications
      GROUP BY status;
    `;
    
    statusCounts.forEach((stat) => {
      console.log(`   - ${stat.status}: ${stat.count}`);
    });

    // 5. Check for recent applications (last 24 hours)
    console.log("\n5. Recent applications (last 24 hours):");
    const recentApps = await sql`
      SELECT 
        a.id,
        a.freelancer_name,
        sr.service_type,
        a.created_at
      FROM job_applications a
      JOIN service_request sr ON a.job_id = sr.id
      WHERE a.created_at > NOW() - INTERVAL '24 hours'
      ORDER BY a.created_at DESC;
    `;
    
    if (recentApps.length > 0) {
      recentApps.forEach((app) => {
        console.log(`   - ${app.freelancer_name} applied to "${app.service_type}" at ${app.created_at}`);
      });
    } else {
      console.log("   No applications in the last 24 hours");
    }

    console.log("\n=== Test Complete ===");
  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    console.error(error);
    process.exit(1);
  }
}

testApplicationFlow();
