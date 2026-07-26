'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function AdminPage() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  
  const [adminTab, setAdminTab] = useState('present'); // 'present' or 'past'
  const [pName, setPName] = useState('');
  const [pPrice, setPPrice] = useState('');
  const [pSizes, setPSizes] = useState('S, M, L, XL');
  const [photoBase64, setPhotoBase64] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [products, setProducts] = useState([]);

  // Default test password - change this string to whatever secret PIN you want!
  const ADMIN_SECRET_PIN = '1234';

  useEffect(() => {
    if (isUnlocked) {
      fetchProducts();
    }
  }, [isUnlocked]);

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').order('id', { ascending: false });
    if (data) setProducts(data);
  };

  const handleUnlock = (e) => {
    e.preventDefault();
    if (pinInput === ADMIN_SECRET_PIN) {
      setIsUnlocked(true);
      setPinError(false);
    } else {
      setPinError(true);
    }
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        setPhotoBase64(evt.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!pName || !pPrice) return alert('Enter product name and price!');

    setIsSaving(true);
    const finalImage = photoBase64 || 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=80';

    const { error } = await supabase.from('products').insert([
      {
        title: pName,
        price: parseFloat(pPrice),
        image_url: finalImage,
      },
    ]);

    setIsSaving(false);

    if (error) {
      alert(`Error saving product: ${error.message}`);
    } else {
      alert(`Added "${pName}" to Present Batch!`);
      setPName('');
      setPPrice('');
      setPSizes('S, M, L, XL');
      setPhotoBase64('');
      fetchProducts();
    }
  };

  const handleDeleteProduct = async (id) => {
    if (confirm('Delete this product from the storefront?')) {
      await supabase.from('products').delete().eq('id', id);
      fetchProducts();
    }
  };

  // 1. PIN LOCK SCREEN
  if (!isUnlocked) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', textAlign: 'center' }}>
        <div style={{ background: '#18181b', border: '1px solid #27272a', padding: '24px', borderRadius: '16px', width: '100%', maxWidth: '360px', boxSizing: 'border-box' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔐</div>
          <h2 style={{ fontSize: '18px', color: '#fff', marginBottom: '4px', marginTop: 0 }}>Admin Access</h2>
          <p style={{ fontSize: '12px', color: '#a1a1aa', marginBottom: '16px' }}>
            Enter secret password to access store management (Default test PIN: <b>1234</b>)
          </p>

          <form onSubmit={handleUnlock}>
            <input
              type="password"
              placeholder="Enter Password"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', background: '#09090b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '8px', marginBottom: '10px', fontSize: '16px', textAlign: 'center', letterSpacing: '2px', boxSizing: 'border-box' }}
            />
            <button
              type="submit"
              style={{ width: '100%', padding: '12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}
            >
              Unlock Dashboard
            </button>
          </form>

          {pinError && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '8px', marginBottom: 0 }}>Incorrect Password!</p>}
        </div>
      </div>
    );
  }

  // 2. UNLOCKED ADMIN PANEL
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: '#fff' }}>STORE ADMIN PANEL</h1>
        <button
          onClick={() => setIsUnlocked(false)}
          style={{ padding: '6px 12px', background: '#27272a', color: '#ef4444', border: '1px solid #3f3f46', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          Lock Panel 🔒
        </button>
      </div>

      {/* TOP SELECTOR (PRESENT vs PAST) */}
      <div style={{ display: 'flex', background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', padding: '4px', marginBottom: '20px' }}>
        <button
          onClick={() => setAdminTab('present')}
          style={{
            flex: 1,
            padding: '10px 0',
            background: adminTab === 'present' ? '#2563eb' : 'none',
            border: 'none',
            color: adminTab === 'present' ? '#fff' : '#a1a1aa',
            fontSize: '13px',
            fontWeight: '700',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          🟢 Present Batch (August)
        </button>
        <button
          onClick={() => setAdminTab('past')}
          style={{
            flex: 1,
            padding: '10px 0',
            background: adminTab === 'past' ? '#2563eb' : 'none',
            border: 'none',
            color: adminTab === 'past' ? '#fff' : '#a1a1aa',
            fontSize: '13px',
            fontWeight: '700',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          📦 Past Orders & Batches
        </button>
      </div>

      {/* TAB 1: PRESENT BATCH */}
      {adminTab === 'present' && (
        <div>
          {/* Add New Product Section */}
          <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '14px', padding: '16px', marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#38bdf8', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.5px' }}>
              + Add New Goods to Present Drop
            </div>

            <form onSubmit={handleSaveProduct}>
              <input
                type="text"
                placeholder="Product Name (e.g. Graphic Hoodie)"
                value={pName}
                onChange={(e) => setPName(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', background: '#09090b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '8px', marginBottom: '10px', fontSize: '13px', boxSizing: 'border-box' }}
              />

              <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <input
                  type="number"
                  placeholder="Price (GH₵)"
                  value={pPrice}
                  onChange={(e) => setPPrice(e.target.value)}
                  style={{ flex: 1, padding: '10px 12px', background: '#09090b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }}
                />
                <input
                  type="text"
                  placeholder="Sizes (S, M, L, XL)"
                  value={pSizes}
                  onChange={(e) => setPSizes(e.target.value)}
                  style={{ flex: 1, padding: '10px 12px', background: '#09090b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              {/* Gallery Photo Upload */}
              <div style={{ background: '#09090b', border: '1px dashed #3f3f46', padding: '12px', borderRadius: '8px', marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', color: '#a1a1aa', display: 'block', marginBottom: '6px' }}>
                  📷 Pick Product Photo from Gallery:
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  style={{ fontSize: '12px', color: '#a1a1aa' }}
                />
                {photoBase64 && (
                  <img
                    src={photoBase64}
                    alt="Preview"
                    style={{ width: '50px', height: '50px', borderRadius: '6px', objectFit: 'cover', marginTop: '8px', display: 'block' }}
                  />
                )}
              </div>

              <button
                type="submit"
                disabled={isSaving}
                style={{ width: '100%', padding: '12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}
              >
                {isSaving ? 'Saving...' : '+ Save Product to Present Batch'}
              </button>
            </form>
          </div>

          {/* Present Batch Goods List */}
          <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '14px', padding: '16px', marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#38bdf8', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.5px' }}>
              Present Batch Goods ({products.length})
            </div>

            {products.length === 0 ? (
              <p style={{ color: '#71717a', fontSize: '12px' }}>No items in present batch.</p>
            ) : (
              products.map((item) => (
                <div
                  key={item.id}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#09090b', border: '1px solid #27272a', padding: '10px', borderRadius: '8px', marginBottom: '8px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img src={item.image_url} alt={item.title} style={{ width: '42px', height: '42px', borderRadius: '6px', objectFit: 'cover' }} />
                    <div>
                      <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '13px' }}>{item.title}</div>
                      <div style={{ fontSize: '11px', color: '#38bdf8' }}>GH₵ {item.price.toFixed(2)} | Sizes: S, M, L, XL</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteProduct(item.id)}
                    style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '12px', cursor: 'pointer' }}
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Customer Orders Received */}
          <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '14px', padding: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#38bdf8', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.5px' }}>
              Present Buyers & Orders Received
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #27272a', textAlign: 'left' }}>
                  <th style={{ color: '#a1a1aa', padding: '8px 4px' }}>Buyer Info</th>
                  <th style={{ color: '#a1a1aa', padding: '8px 4px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #27272a' }}>
                  <td style={{ padding: '8px 4px', color: '#fff' }}>kwame@gmail.com</td>
                  <td style={{ padding: '8px 4px', color: '#4ade80' }}>70% Deposit</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: PAST BATCHES */}
      {adminTab === 'past' && (
        <div>
          <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '14px', padding: '16px', marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#38bdf8', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>
              July Batch (Past / Closed)
            </div>
            <div style={{ fontSize: '12px', color: '#a1a1aa', marginBottom: '8px' }}>
              Goods Sold: Acid Wash Cargo Pants, Oversized Hoodies
            </div>
          </div>

          <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '14px', padding: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#38bdf8', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>
              June Batch (Past / Delivered)
            </div>
            <div style={{ fontSize: '12px', color: '#a1a1aa' }}>Total Sales Recorded: GH₵ 2,450.00 (14 Buyers)</div>
          </div>
        </div>
      )}
    </div>
  );
}
