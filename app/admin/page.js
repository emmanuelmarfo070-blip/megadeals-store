'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function AdminPage() {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [currentBatch, setCurrentBatch] = useState('Batch 1');
  const [newBatchName, setNewBatchName] = useState('');

  // Product form inputs
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    // Load orders
    const { data: orderData } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (orderData) setOrders(orderData);

    // Load storefront products
    const { data: prodData } = await supabase.from('products').select('*');
    if (prodData) setProducts(prodData);

    // Load current active batch
    const { data: batchData } = await supabase.from('batches').select('batch_name').eq('is_active', true).single();
    if (batchData) setCurrentBatch(batchData.batch_name);
  };

  // ADD NEW PRODUCT TO STOREFRONT
  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!title || !price || !imageUrl) return alert('Fill in all fields!');

    const { error } = await supabase.from('products').insert([
      { title, price: parseFloat(price), image_url: imageUrl }
    ]);

    if (!error) {
      alert('Product added!');
      setTitle(''); setPrice(''); setImageUrl('');
      loadData();
    } else {
      alert('Error: ' + error.message);
    }
  };

  // START NEW BATCH (Clears old storefront)
  const handleStartNewBatch = async () => {
    if (!newBatchName) return alert('Enter a name for the new batch (e.g., Batch 2)');

    const confirm = window.confirm(`Are you sure you want to end ${currentBatch} and start ${newBatchName}? This clears all storefront products, but ALL past orders remain safe!`);
    if (!confirm) return;

    // 1. Deactivate old batch records
    await supabase.from('batches').update({ is_active: false }).neq('id', 0);

    // 2. Insert new active batch
    await supabase.from('batches').insert([{ batch_name: newBatchName, is_active: true }]);

    // 3. Clear products table
    await supabase.from('products').delete().neq('id', 0);

    setCurrentBatch(newBatchName);
    setNewBatchName('');
    loadData();
    alert(`Batch updated to ${newBatchName}! Storefront is now clear for new products.`);
  };

  // UPDATE ORDER STATUS & DELIVERY FEE
  const updateOrderDetails = async (orderId, status, deliveryFee) => {
    const { error } = await supabase.from('orders').update({
      status: status,
      delivery_fee: parseFloat(deliveryFee || 0)
    }).eq('id', orderId);

    if (!error) {
      alert('Order status updated!');
      loadData();
    } else {
      alert('Error updating order: ' + error.message);
    }
  };

  return (
    <div style={{ padding: '20px', background: '#09090b', color: '#fff', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: '20px', color: '#2563eb' }}>👑 Megadeals Admin Dashboard</h1>

      {/* SECTION 1: BATCH MANAGEMENT */}
      <section style={{ background: '#18181b', padding: '16px', borderRadius: '12px', border: '1px solid #27272a', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '15px', margin: '0 0 10px' }}>📦 Active Batch: <span style={{ color: '#4ade80' }}>{currentBatch}</span></h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="New Batch Name (e.g. Batch 2 - August Drop)"
            value={newBatchName}
            onChange={(e) => setNewBatchName(e.target.value)}
            style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #3f3f46', background: '#09090b', color: '#fff' }}
          />
          <button onClick={handleStartNewBatch} style={{ padding: '10px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
            🚨 End Batch & Start New
          </button>
        </div>
      </section>

      {/* SECTION 2: ADD PRODUCT TO CURRENT STOREFRONT */}
      <section style={{ background: '#18181b', padding: '16px', borderRadius: '12px', border: '1px solid #27272a', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '15px', margin: '0 0 12px' }}>➕ Post New Item ({currentBatch})</h2>
        <form onSubmit={handleAddProduct} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input type="text" placeholder="Item Title (e.g. Graphic Hoodie)" value={title} onChange={(e) => setTitle(e.target.value)} style={{ padding: '10px', background: '#09090b', border: '1px solid #3f3f46', borderRadius: '6px', color: '#fff' }} />
          <input type="number" placeholder="Price (GH₵)" value={price} onChange={(e) => setPrice(e.target.value)} style={{ padding: '10px', background: '#09090b', border: '1px solid #3f3f46', borderRadius: '6px', color: '#fff' }} />
          <input type="url" placeholder="Image URL" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} style={{ padding: '10px', background: '#09090b', border: '1px solid #3f3f46', borderRadius: '6px', color: '#fff' }} />
          <button type="submit" style={{ padding: '10px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Upload Item to Store</button>
        </form>
      </section>

      {/* SECTION 3: ORDER STATUS & DELIVERY TRACKER */}
      <section>
        <h2 style={{ fontSize: '15px', marginBottom: '12px' }}>🛒 Customer Orders Management</h2>
        {orders.map((order) => (
          <div key={order.id} style={{ background: '#18181b', padding: '14px', borderRadius: '10px', marginBottom: '12px', border: '1px solid #27272a' }}>
            <div style={{ fontSize: '12px', color: '#a1a1aa', marginBottom: '4px' }}>
              Phone: <b style={{ color: '#fff' }}>{order.customer_phone}</b> | Batch: <b>{order.batch_name}</b>
            </div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>{order.items}</div>
            <div style={{ fontSize: '12px', color: '#4ade80', marginBottom: '10px' }}>Deposit Paid: GH₵ {order.amount_paid}</div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <select
                defaultValue={order.status}
                id={`status-${order.id}`}
                style={{ padding: '8px', background: '#09090b', color: '#fff', border: '1px solid #3f3f46', borderRadius: '6px' }}
              >
                <option value="Deposit Paid (70%)">Deposit Paid (70%)</option>
                <option value="Ordered from China">Ordered from China</option>
                <option value="In Transit to Ghana">In Transit to Ghana</option>
                <option value="Arrived - Balance Due">Arrived - Balance Due</option>
                <option value="Out for Delivery">Out for Delivery</option>
                <option value="Delivered">Delivered</option>
              </select>

              <input
                type="number"
                placeholder="Delivery Fee (GH₵)"
                defaultValue={order.delivery_fee}
                id={`fee-${order.id}`}
                style={{ width: '130px', padding: '8px', background: '#09090b', color: '#fff', border: '1px solid #3f3f46', borderRadius: '6px' }}
              />

              <button
                onClick={() => {
                  const status = document.getElementById(`status-${order.id}`).value;
                  const fee = document.getElementById(`fee-${order.id}`).value;
                  updateOrderDetails(order.id, status, fee);
                }}
                style={{ padding: '8px 14px', background: '#22c55e', color: '#000', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Save
              </button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
