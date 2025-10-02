import { NextResponse } from 'next/server';

export async function GET() {
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    service: 'fonflix-frontend',
    version: '1.0.0'
  };
  
  return NextResponse.json(healthData, { status: 200 });
}