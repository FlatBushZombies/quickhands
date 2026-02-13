import express from 'express';

const router = express.Router();

// Test endpoint to verify deployment
router.get('/test-apply', async (req, res) => {
  try {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(process.env.DATABASE_URL);
    
    // Check if quotation and conditions columns exist
    const columns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'job_applications'
      ORDER BY ordinal_position;
    `;
    
    return res.json({
      success: true,
      message: 'Backend is deployed and working',
      columns: columns.map(c => c.column_name),
      hasQuotation: columns.some(c => c.column_name === 'quotation'),
      hasConditions: columns.some(c => c.column_name === 'conditions'),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
    });
  }
});

export default router;
