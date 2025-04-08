export interface Investment {
  id: string;
  amount: number;
  start_date: string | null;
  end_date: string | null;
  status: 'pending_proof' | 'pending_approval' | 'active' | 'completed' | 'rejected' | 'cancelled';
  created_at: string;
}

export interface InvestmentPlan {
  amount: number;
  monthlyROI: number;
  totalReturns: number;
  durationMonths: number;
}