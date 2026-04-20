export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthenticatedUser } from '@/lib/supabase';

// GET /api/portfolio/buyers — Get buyer creditworthiness database
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    
    const auth = await getAuthenticatedUser(token);

    if (!auth) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const admin = supabaseAdmin;

    // Fetch all buyers with their trade performance history
    const { data: buyers, error } = await admin
      .from('buyers')
      .select(`
        *,
        trades (
          id,
          stage,
          contract_value_usd,
          settled_at
        )
      `);

    if (error) {
      console.error('Buyers fetch error:', error);
      return NextResponse.json({ error: 'DATABASE_ERROR' }, { status: 500 });
    }

    const processedBuyers = (buyers as any[] || []).map(b => {
      const completedTrades = b.trades?.filter((t: any) => t.stage === 'SETTLED') || [];
      return {
        id: b.id,
        name: b.name,
        country: b.country,
        sanctions_clear: b.sanctions_clear || false, 
        trades_completed: completedTrades.length,
        trades_on_time: completedTrades.length, // Placeholder logic
        disputes: 0, // Placeholder
        total_volume_usd: completedTrades.reduce((sum: number, t: any) => sum + (t.contract_value_usd || 0), 0),
        last_trade_date: completedTrades[0]?.settled_at || null,
        credit_rating: b.id.includes('v') ? 'A+' : 'A', // Mock derived rating
      };
    });

    return NextResponse.json(processedBuyers);
  } catch (error) {
    console.error('GET /api/portfolio/buyers error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
