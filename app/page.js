'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function Home() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProducts() {
      try {
        const { data, error } = await supabase.from('products').select('*');
        if (error) throw error;
        setProducts(data || []);
      } catch (err) {
        console.error('Error fetching products:', err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchProducts();
  }, []);

  return (
    <main style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      <header style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Megadeals Imports</h1>
        <p style={{ color: '#666' }}>Live Preorder Store</p>
      </header>

      {loading ? (
        <p style={{ textAlign: 'center' }}>Loading products...</p>
      ) : products.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#888' }}>No preorders available right now.</p>
      ) : (
        <div style={{ display: 'grid', gap: '20px' }}>
          {products.map((product) => (
            <div
              key={product.id}
              style={{
                border: '1px solid #eee',
                borderRadius: '8px',
                padding: '16px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
              }}
            >
              {product.image_url && (
                <img
                  src={product.image_url}
                  alt={product.title}
                  style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '6px' }}
                />
              )}
              <h2 style={{ fontSize: '18px', margin: '12px 0 6px' }}>{product.title}</h2>
              <p style={{ fontWeight: 'bold', color: '#0070f3', margin: '0 0 12px' }}>
                GHS {product.price}
              </p>
              <button
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: '#000',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
                onClick={() => alert(`Order placed for ${product.title}`)}
              >
                Preorder Now
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
