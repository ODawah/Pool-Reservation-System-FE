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

export interface TableSession {
  id: number;
  label: string;
  type: 'pool' | 'carrom' | 'ps';
  isActive: boolean;
  startTime: number | null;
  orders: OrderItem[];
}

export interface Employee {
  id?: number;
  name: string;
  role: string;
  salary: number;
}

export interface AttendanceRecord {
  employeeID: number;
  clock_in_time?: string;
  clock_out_time?: string;
  today_cash?: number;
}

export interface RevenueRecord {
  source: 'cash' | 'visa';
  amount: number;
  date: string;
}

export interface ExpenseRecord {
  description: string;
  amount: number;
}

export interface ReceiptPayload {
  table_id: number;
  items: {
    table_time_minutes: number;
    shop_items: Array<{
      item_id: number;
      name: string;
      qty: number;
      unit_price: number;
    }>;
  };
  total_price: number;
}
