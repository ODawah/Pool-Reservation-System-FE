export interface ShopItem {
  id?: number;
  name: string;
  price: number;
  quantity: number;
}

export interface OrderItem {
  shopItem: ShopItem;
  quantity: number;
}

export interface TableInfo {
  id: number;
  name: string;
  price: number;
}

export interface TableSession {
  id: number;
  label: string;
  type: 'pool' | 'carrom' | 'ps';
  isActive: boolean;
  startTime: number | null;
  orders: OrderItem[];
  pricePerMinute: number;
}

export interface Employee {
  id?: number;
  name: string;
  role: string;
  salary: number;
}

export interface AttendanceRecord {
  id?: number;
  employee_id: number;
  clock_in_time?: string;
  clock_out_time?: string;
}

export interface RevenueRecord {
  id?: number;
  source: string;
  amount: number;
}

export interface ExpenseRecord {
  description: string;
  amount: number;
}

export interface ReceiptPayload {
  table_id: number;
  items: Record<string, number>;
  total_price: number;
}

export interface Receipt {
  id: number;
  table_id: number;
  items: Record<string, number>;
  total_price: number;
  timestamp: string;
}
