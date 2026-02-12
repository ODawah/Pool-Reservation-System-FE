import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Square, Plus, Minus, Coffee } from 'lucide-react';
import type { TableSession, ShopItem } from '@/types/pool-hall';

interface Props {
  session: TableSession;
  shopItems: ShopItem[];
  onStart: (id: number) => void;
  onStop: (id: number) => void;
  onAddItem: (tableId: number, item: ShopItem) => void;
  onRemoveItem: (tableId: number, itemIndex: number) => void;
}

const typeIcon: Record<string, string> = { pool: '🎱', carrom: '⚫', ps: '🎮' };

const TableCard = ({ session, shopItems, onStart, onStop, onAddItem, onRemoveItem }: Props) => {
  const [showMenu, setShowMenu] = useState(false);
  const [elapsed, setElapsed] = useState('00:00');

  useEffect(() => {
    if (!session.isActive || !session.startTime) { setElapsed('00:00'); return; }
    const tick = () => {
      const diff = Date.now() - session.startTime!;
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setElapsed(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [session.isActive, session.startTime]);

  const orderTotal = session.orders.reduce((sum, o) => sum + o.shopItem.price * o.quantity, 0);

  return (
    <Card className={`relative overflow-hidden transition-all duration-300 ${
      session.isActive 
        ? 'glow-green border-primary/60' 
        : 'border-border/50 hover:border-border'
    }`}>
      {/* Felt texture overlay for active tables */}
      {session.isActive && <div className="absolute inset-0 felt-texture pointer-events-none" />}
      
      <CardContent className="relative p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{typeIcon[session.type]}</span>
            <h3 className="font-bold text-lg text-foreground">{session.label}</h3>
          </div>
          <Badge 
            variant={session.isActive ? 'default' : 'secondary'}
            className={session.isActive ? 'bg-primary text-primary-foreground animate-pulse font-mono text-sm' : ''}
          >
            {session.isActive ? elapsed : 'Idle'}
          </Badge>
        </div>

        {/* Orders list */}
        {session.orders.length > 0 && (
          <div className="space-y-1 rounded-lg bg-muted/60 p-3 text-sm backdrop-blur-sm">
            {session.orders.map((o, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-foreground/80">{o.shopItem.name} × {o.quantity}</span>
                <div className="flex items-center gap-2">
                  <span className="text-accent font-medium">${(o.shopItem.price * o.quantity).toFixed(2)}</span>
                  <Button size="icon" variant="ghost" className="h-5 w-5 text-muted-foreground hover:text-destructive" onClick={() => onRemoveItem(session.id, i)}>
                    <Minus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
            <div className="border-t border-border/50 pt-1.5 mt-1.5 font-semibold flex justify-between text-accent">
              <span>Total</span>
              <span>${orderTotal.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          {!session.isActive ? (
            <Button onClick={() => onStart(session.id)} className="flex-1 bg-primary hover:bg-primary/80">
              <Play className="mr-2 h-4 w-4" /> Start
            </Button>
          ) : (
            <Button variant="destructive" onClick={() => onStop(session.id)} className="flex-1">
              <Square className="mr-2 h-4 w-4" /> Stop & Bill
            </Button>
          )}
          <Button variant="outline" onClick={() => setShowMenu(!showMenu)} className={`${showMenu ? 'border-accent text-accent' : ''}`}>
            <Coffee className="h-4 w-4" />
          </Button>
        </div>

        {/* Shop menu */}
        {showMenu && (
          <div className="grid grid-cols-2 gap-1.5 pt-1">
            {shopItems.map(item => (
              <Button
                key={item.id ?? item.name}
                size="sm"
                variant="outline"
                className="justify-between text-xs h-9 hover:border-accent hover:text-accent"
                onClick={() => onAddItem(session.id, item)}
                disabled={item.quantity <= 0}
              >
                <span className="truncate">{item.name}</span>
                <span className="text-muted-foreground ml-1">${item.price}<span className="opacity-60"> ({item.quantity})</span></span>
              </Button>
            ))}
            {shopItems.length === 0 && (
              <p className="col-span-2 text-center text-sm text-muted-foreground py-2">No items available</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TableCard;
