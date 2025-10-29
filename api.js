const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY in env');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function getUserIdFromReq(req) {
  return req.headers['x-user-id'] || req.body.user_id || req.query.user_id || null;
}

/* Create group */
router.post('/groups', async (req, res) => {
  const user_id = getUserIdFromReq(req);
  const { name, description, topic } = req.body;
  if (!user_id) return res.status(401).json({ error: 'Missing user_id (auth)' });
  if (!name) return res.status(400).json({ error: 'Missing name' });

  const slug = name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');

  const { data, error } = await supabase
    .from('groups')
    .insert([{ name, slug, description, owner_id: user_id, topic }])
    .select()
    .single();

  if (error) return res.status(500).json({ error });
  await supabase.from('group_members').insert([{ group_id: data.id, user_id }]);
  res.json({ group: data });
});

/* Get all groups */
router.get('/groups', async (req, res) => {
  const { data, error } = await supabase.from('groups').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error });
  res.json({ groups: data });
});

/* Get single group */
router.get('/groups/:id', async (req, res) => {
  const id = req.params.id;
  const { data, error } = await supabase.from('groups').select('*').eq('id', id).single();
  if (error) return res.status(500).json({ error });
  res.json({ group: data });
});

/* Join group */
router.post('/groups/:id/join', async (req, res) => {
  const user_id = getUserIdFromReq(req);
  const group_id = req.params.id;
  if (!user_id) return res.status(401).json({ error: 'Missing user_id' });

  const { data, error } = await supabase
    .from('group_members')
    .insert([{ group_id, user_id }])
    .select()
    .single();

  if (error) {
    // if unique violation (already member)
    return res.status(400).json({ error });
  }
  res.json({ member: data });
});

/* Leave group */
router.post('/groups/:id/leave', async (req, res) => {
  const user_id = getUserIdFromReq(req);
  const group_id = req.params.id;
  if (!user_id) return res.status(401).json({ error: 'Missing user_id' });

  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', group_id)
    .eq('user_id', user_id);

  if (error) return res.status(500).json({ error });
  res.json({ ok: true });
});

/* Get joined groups for user */
router.get('/my-groups', async (req, res) => {
  const user_id = getUserIdFromReq(req);
  if (!user_id) return res.status(401).json({ error: 'Missing user_id' });

  const { data, error } = await supabase
    .from('group_members')
    .select('group_id, joined_at, groups (id, name, slug, description, topic)')
    .eq('user_id', user_id);

  if (error) return res.status(500).json({ error });
  const groups = data.map(row => ({ group_id: row.group_id, joined_at: row.joined_at, ...row.groups }));
  res.json({ groups });
});

/* Post message to group */
router.post('/groups/:id/messages', async (req, res) => {
  const user_id = getUserIdFromReq(req);
  const group_id = req.params.id;
  const { content } = req.body;
  if (!user_id) return res.status(401).json({ error: 'Missing user_id' });
  if (!content) return res.status(400).json({ error: 'Missing content' });

  const { data, error } = await supabase
    .from('group_messages')
    .insert([{ group_id, user_id, content }])
    .select()
    .single();
  if (error) return res.status(500).json({ error });
  res.json({ message: data });
});

/* Get messages for a group */
router.get('/groups/:id/messages', async (req, res) => {
  const group_id = req.params.id;
  const { limit = 50 } = req.query;
  const { data, error } = await supabase
    .from('group_messages')
    .select('id, user_id, content, created_at')
    .eq('group_id', group_id)
    .order('created_at', { ascending: true })
    .limit(parseInt(limit));
  if (error) return res.status(500).json({ error });
  res.json({ messages: data });
});

module.exports = router;
