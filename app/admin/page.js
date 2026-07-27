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

  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    // Fetch all orders permanently
    const { data: orderData } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (orderData) setOrders(orderData);

    // Fetch active products
    const { data: prodData } = await supabase.from('products').select('*');
    if (prodData) setProducts(prodData);

    // Fetch active batch name
    const { data: batchData } = await supabase
      .from('batches')
      .select('batch_name')
      .eq('is_active', true)
      .single();
    if (batchData) setCurrentBatch(batchData.batch_name);
  };

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
      alert('Error adding product: ' + error.message);
    }
  };

  const handleStartNewBatch = async () => {
    if (!newBatchName) return alert('Enter a name for the new batch');

    const confirm = window.confirm(
      `End ${currentBatch} and start ${newBatchName}? Storefront products will be cleared, but ALL past customer orders will remain safely saved in your database.`
    );
    if (!confirm) return;

    // Deactivate previous batch
    await supabase.from('batches').update({ is_active: false }).neq('id', 0);
    
    // Create new batch
    await supabase.from('batches').insert([{ batch_name: newBatchName, is_active: true }]);
    
    // Clear active products catalog for the new batch
    await supabase.from('products').delete().neq('id', 0);

    setCurrentBatch(newBatchName);
    setNewBatchName('');
    loadData();
    alert(`Started ${newBatchName}! Storefront catalog is cleared for new uploads.`);
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);

    if (!error) {
      alert('Order status updated!');
      loadData();
    } else {
      alert('Error updating order: ' + error.message);
    }
  };

  return (
    <div style={{ padding: '20px', background: '#09090b', color: '#fff', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: '20px', color: '#2563eb', marginBottom: '20px' }}>👑 Megadeals Admin Dashboard</h1>

      {/* BATCH CONTROL */}
      <section style={{ background: '#18181b', padding: '16px', borderRadius: '12px', border: '1px solid #27272a', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '15px', margin: '0 0 10px' }}>📦 Active Batch: <span style={{ color: '#4ade80' }}>{currentBatch}</span></h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="New Batch Name (e.g. Batch 2)"
            value={newBatchName}
            onChange={(e) => setNewBatchName(e.target.value)}
            style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #3f3f46', background: '#09090b', color: '#fff' }}
          />
          <button onClick={handleStartNewBatch} style={{ padding: '10px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
            🚨 End Batch & Start New
          </button>
        </div>
      </section>

      {/* ADD ITEM */}
      <section style={{ background: '#18181b', padding: '16px', borderRadius: '12px', border: '1px solid #27272a', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '15px', margin: '0 0 12px' }}>➕ Post Item to {currentBatch}</h2>
        <form onSubmit={handleAddProduct} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input type="text" placeholder="Item Title" value={title} onChange={(e) => setTitle(e.target.value)} style={{ padding: '10px', background: '#09090b', border: '1px solid #3f3f46', borderRadius: '6px', color: '#fff' }} />
          <input type="number" placeholder="Price (GH₵)" value={price} onChange={(e) => setPrice(e.target.value)} style={{ padding: '10px', background: '#09090b', border: '1px solid #3f3f46', borderRadius: '6px', color: '#fff' }} />
          <input type="url" placeholder="Image URL" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} style={{ padding: '10px', background: '#09090b', border: '1px solid #3f3f46', borderRadius: '6px', color: '#fff' }} />
          <button type="submit" style={{ padding: '10px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Upload Item to Store</button>
        </form>
      </section>

      {/* ORDERS & SHIPPING */}
      <section>
        <h2 style={{ fontSize: '15px', marginBottom: '12px' }}>🛒 Past & Present Orders ({orders.length})</h2>
        {orders.length === 0 ? <p style={{ color: '#a1a1aa' }}>No orders recorded yet.</p> : (
          orders.map((order) => (
            <div key={order.id} style={{ background: '#18181b', padding: '14px', borderRadius: '10px', marginBottom: '12px', border: '1px solid #27272a' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#a1a1aa', marginBottom: '6px' }}>
                <span>Phone: <b style={{ color: '#fff' }}>{order.customer_phone}</b></span>
                <span style={{ background: '#27272a', padding: '2px 6px', borderRadius: '4px' }}>{order.batch_name || 'Batch 1'}</span>
              </div>
              
              <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '6px', color: '#fff' }}>{order.items}</div>
              
              <div style={{ fontSize: '12px', color: '#4ade80', marginBottom: '10px' }}>
                Paid Initial: GH₵ {order.amount_paid} ({order.deposit_percentage || 70}%) 
                {order.delivery_fee ? ` | Delivery Fee: GH₵ ${order.delivery_fee}` : ''}
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select
                  defaultValue={order.status}
                  id={`status-${order.id}`}
                  style={{ flex: 1, padding: '8px', background: '#09090b', color: '#fff', border: '1px solid #3f3f46', borderRadius: '6px', fontSize: '12px' }}
                >
                  <option value="Deposit Paid (70%)">Deposit Paid (70%)</option>
                  <option value="Full Payment (100%)">Full Payment (100%)</option>
                  <option value="Ordered from China">Ordered from China</option>
                  <option value="In Transit to Ghana">In Transit to Ghana</option>
                  <option value="Arrived - Balance Due">Arrived - Balance Due</option>
                  <option value="Balance Paid - Processing Delivery">Balance Paid - Processing Delivery</option>
                  <option value="Out for Delivery">Out for Delivery</option>
                  <option value="Delivered">Delivered</option>
                </select>

                <button
                  onClick={() => {
                    const newStatus = document.getElementById(`status-${order.id}`).value;
                    updateOrderStatus(order.id, newStatus);
                  }}
                  style={{ padding: '8px 14px', background: '#22c55e', color: '#000', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}
                >
                  Save Status
                </button>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
