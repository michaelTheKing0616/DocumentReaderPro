import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateNoteRequest {
  oauthToken: string;
  title: string;
  content: string;
  notebookGuid?: string;
  sandbox?: boolean;
}

/** Evernote note creation proxy — uses EDAM noteStore createNote Thrift-over-HTTP pattern via official endpoint. */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as CreateNoteRequest;
    const { oauthToken, title, content, notebookGuid, sandbox = true } = body;

    if (!oauthToken || !title || !content) {
      return new Response(JSON.stringify({ error: 'oauthToken, title, and content required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const host = sandbox ? 'sandbox.evernote.com' : 'www.evernote.com';
    const userResponse = await fetch(`https://${host}/edam/user`, {
      headers: { Authorization: `Bearer ${oauthToken}` },
    });

    if (!userResponse.ok) {
      const text = await userResponse.text();
      return new Response(JSON.stringify({ error: 'Evernote auth failed', detail: text }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const user = (await userResponse.json()) as {
      shard?: string;
      noteStoreUrl?: string;
    };

    const noteStoreUrl = user.noteStoreUrl ?? `https://${user.shard ?? 'sandbox'}.evernote.com/shard/s1/notestore`;

    const enml = content.startsWith('<?xml')
      ? content
      : `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE en-note SYSTEM "http://xml.evernote.com/pub/enml2.dtd">
<en-note>${escapeXml(content)}</en-note>`;

    const createResponse = await fetch(`${noteStoreUrl}/note`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${oauthToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        content: enml,
        notebookGuid: notebookGuid ?? undefined,
      }),
    });

    if (!createResponse.ok) {
      const text = await createResponse.text();
      return new Response(JSON.stringify({ error: 'createNote failed', detail: text }), {
        status: createResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const note = (await createResponse.json()) as { guid?: string; note?: { guid?: string } };
    const noteId = note.guid ?? note.note?.guid ?? `en_${Date.now()}`;

    return new Response(JSON.stringify({ noteId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Evernote proxy failed';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
