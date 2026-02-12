import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Square, Plus, Minus } from 'lucide-react';
import type { TableSession, ShopItem, OrderItem } from '@/types/pool-hall';

interface Props {
  session: TableSession;
  shopItems: ShopItem[];
  onStart: (id: number) => void;
  onStop: (id: number) => void;
  onAddItem: (tableId: number, item: ShopItem) => void;
  onRemoveItem: (tableId: number, itemIndex: number) => void;
}

const TableCard = ({ session, shopItems, onStart, onStop, onAddItem, onRemoveItem }: Props) => {
  const [showMenu, setShowMenu] = useState(false);
  const [elapsed, setElapsed] = useState('00:00');

  // Timer display
  useState(() => {
    if (!session.isActive || !session.startTime) return;
    const interval = setInterval(() => {
      const diff = Date.now() - session.startTime!;
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setElapsed(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  });

  const orderTotal = session.orders.reduce((sum, o) => sum + o.shopItem.price * o.quantity, 0);

  return (
    <Card className={`transition-all ${session.isActive ? 'border-primary shadow-lg' : ''}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{session.label}</CardTitle>
          <Badge variant={session.isActive ? 'default' : 'secondary'}>
            {session.isActive ? elapsed : 'Idle'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Orders list - always visible when items exist */}
        {session.orders.length > 0 && (
          <div className="space-y-1 rounded-md bg-muted p-2 text-sm">
            {session.orders.map((o, i) => (
              <div key={i} className="flex items-center justify-between">
                <span>{o.shopItem.name} × {o.quantity}</span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">${(o.shopItem.price * o.quantity).toFixed(2)}</span>
                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => onRemoveItem(session.id, i)}>
                    <Minus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
            <div className="border-t border-border pt-1 font-medium flex justify-between">
              <span>Items total</span>
              <span>${orderTotal.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          {!session.isActive ? (
            <Button size="sm" onClick={() => onStart(session.id)} className="flex-1">
              <Play className="mr-1 h-4 w-4" /> Start
            </Button>
          ) : (
            <Button size="sm" variant="destructive" onClick={() => onStop(session.id)} className="flex-1">
              <Square className="mr-1 h-4 w-4" /> Stop & Bill
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setShowMenu(!showMenu)}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Shop menu */}
        {showMenu && (
          <div className="grid grid-cols-2 gap-1">
            {shopItems.map(item => (
              <Button
                key={item.id ?? item.name}
                size="sm"
                variant="outline"
                className="justify-between text-xs"
                onClick={() => onAddItem(session.id, item)}
                disabled={item.quantity <= 0}
              >
                <span>{item.name}</span>
                <span className="text-muted-foreground">${item.price} ({item.quantity})</span>
              </Button>
            ))}
            {shopItems.length === 0 && (
              <p className="col-span-2 text-center text-sm text-muted-foreground">No items available</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TableCard;
