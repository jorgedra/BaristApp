import { useLocation, useNavigate } from 'react-router-dom';
import { db } from '../lib/db';
import { CoffeeForm } from '../components/CoffeeForm';
import type { Coffee } from '../lib/types';

/** Alta manual de un café. Desde la lista de deseos llega con datos y `wishId` en el state. */
export default function NewCoffee() {
  const navigate = useNavigate();
  const state = (useLocation().state ?? {}) as { prefill?: Partial<Coffee>; wishId?: number };

  return (
    <>
      <h1>Nuevo café</h1>
      <CoffeeForm
        initial={state.prefill ?? {}}
        withGrams
        onCancel={() => navigate(-1)}
        onSave={async (fields, grams) => {
          const now = new Date().toISOString();
          const id = (await db.transaction('rw', db.coffees, db.wishlist, async () => {
            const cid = (await db.coffees.add({
              ...fields,
              inStock: true,
              ...(grams !== undefined && { stockGrams: grams, stockSetAt: now }),
              createdAt: now,
            })) as number;
            if (state.wishId !== undefined) await db.wishlist.update(state.wishId, { status: 'bought', coffeeId: cid });
            return cid;
          })) as number;
          navigate(`/cafe/${id}`, { replace: true });
        }}
      />
    </>
  );
}
