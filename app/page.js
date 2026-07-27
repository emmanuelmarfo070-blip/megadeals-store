'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Storefront() {
  const [activeBatch, setActiveBatch] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActiveBatchAndProducts();
  }, []);

  const fetchActiveBatchAndProducts = async () => {
    setLoading(true);

    // 1. Get the current active batch
    const { data: batchData } = await supabase
      .from('batches')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    if (batchData) {
      setActiveBatch(batchData);

      // 2. Fetch ONLY products linked to this active batch ID
      const { data: prodData } = await supabase
        .from('products')
        .select('*')
        .eq('batch_id', batchData.id)
        .order('id', { ascending: false });

      if (prodData) setProducts(prodData);
    } else {
      setActiveBatch(null);
      setProducts([]);
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div style={{ background: '#09090b', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'sans-serif' }}>
        <p>Loading Store...</p>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#09090b', color: '#f4f4f5', minHeight: '100vh', padding: '16px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>

        {/* HEADER */}
        <header style={{ textAlign: 'center', margin: '20px 0 30px 0' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 900, letterSpacing: '1px' }}>MEGADEALS IMPORTS</h1>
          {activeBatch ? (
            <span style={{ display: 'inline-block', background: '#1e3a8a', color: '#93c5fd', fontSize: '12px', fontWeight: 700, padding: '4px 12px', borderRadius: '20px', marginTop: '8px' }}>
              🔴 ACTIVE DROP: {activeBatch.batch_name.toUpperCase()}
            </span>
          ) : (
            <span style={{ display: 'inline-block', background: '#27272a', color: '#a1a1aa', fontSize: '12px', fontWeight: 700, padding: '4px 12px', borderRadius: '20px', marginTop: '8px' }}>
              NO ACTIVE DROP RIGHT NOW
            </span>
          )}
        </header>

        {/* PRODUCTS GRID */}
        {!activeBatch || products.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', background: '#18181b', borderRadius: '16px', border: '1px solid #27272a' }}>
            <p style={{ color: '#a1a1aa', fontSize: '14px' }}>No items available in this drop yet. Check back soon!</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
            {products.map((p) => (
              <div key={p.id} style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '16px', overflow: 'hidden' }}>
                <img src={p.image_url || 'https://via.placeholder.com/300'} alt={p.title} style={{ width: '100%', height: '240px', objectFit: 'cover' }} />
                <div style={{ padding: '16px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 6px 0' }}>{p.title}</h3>
                  <p style={{ fontSize: '12px', color: '#a1a1aa', margin: '0 0 12px 0' }}>Sizes: {p.sizes}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '16px', fontWeight: 900, color: '#38bdf8' }}>GH₵ {p.price}</span>
                    <button style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}>
                      Preorder Now
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
