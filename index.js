import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import https from 'https';
import axios from 'axios';

const app = express();
app.use(cors());

const CHANNEL_SECRET = process.env.CHANNEL_SECRET || '';
const ACCESS_TOKEN   = process.env.ACCESS_TOKEN   || '';
const LIFF_URL       = process.env.LIFF_URL       || 'https://liff.line.me/2009494770-WmMe004d';

const PRODUCTS = [
  { id:1, name:'ซองม้วน A4 (แพ็ค 100)',   unit:'แพ็ค', price:250 },
  { id:2, name:'ซองม้วน A3 (แพ็ค 100)',   unit:'แพ็ค', price:380 },
  { id:3, name:'ซองม้วน F4 (แพ็ค 100)',   unit:'แพ็ค', price:290 },
  { id:4, name:'ซองม้วนใส A4 (แพ็ค 100)', unit:'แพ็ค', price:320 },
  { id:5, name:'ซองม้วนใส A3 (แพ็ค 100)', unit:'แพ็ค', price:450 },
  { id:6, name:'ซองม้วนกันน้ำ A4',         unit:'แพ็ค', price:480 },
  { id:7, name:'บรรจุภัณฑ์พิเศษ',          unit:'ชิ้น', price:150 },
];

app.get('/', (_req, res) => res.send('Innovation Link Webhook OK 🟢'));
app.get('/products', (_req, res) => res.json(PRODUCTS));

app.post('/webhook', express.raw({ type: '*/*' }), async (req, res) => {
  const signature = req.headers['x-line-signature'];
  const body = req.body.toString('utf8');

  if (CHANNEL_SECRET) {
    const hash = crypto.createHmac('SHA256', CHANNEL_SECRET).update(body).digest('base64');
    if (hash !== signature) {
      console.error('Invalid signature');
      return res.status(401).send('Invalid signature');
    }
  }

  let events;
  try {
    events = JSON.parse(body).events;
  } catch (err) {
    console.error('Invalid JSON:', err);
    return res.status(400).send('Invalid JSON');
  }

  console.log(`Received ${events.length} event(s)`);

  try {
    await Promise.all(events.map(ev => handleEvent(ev)));
  } catch (err) {
    console.error('Event processing error:', err);
  }

  res.json({ ok: true });
});

async function handleEvent(event) {
  if (event.type !== 'message' || event.message?.type !== 'text') return;

  const text  = event.message.text.trim();
  const token = event.replyToken;
  console.log('Text received:', text);

  if (/รายการสินค้า|สินค้า|ราคา/.test(text)) {
    console.log('→ Sending product carousel');
    return replyMsg(token, productCarousel());
  } else if (/เอกสาร|ใบเสนอ|ใบเสร็จ|ใบ/.test(text)) {
    console.log('→ Sending doc menu');
    return replyMsg(token, docMenu());
  } else if (/สวัสดี|เมนู|help|hi/i.test(text)) {
    console.log('→ Sending welcome');
    return replyMsg(token, welcome());
  } else {
    console.log('→ Using Gemini AI');
    const aiText = await askAI(text);
    return replyMsg(token, { type: 'text', text: aiText });
  }
}

// ── Gemini AI ─────────────────────────────────────────────
async function askAI(userText) {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${process.env.GOOGLE_GEMINI_API_KEY}`;

    const response = await axios.post(url, {
      contents: [{
        parts: [{
          text: `คุณคือพนักงานขายของบริษัท Innovation Link จำหน่ายซองม้วนและบรรจุภัณฑ์ ตอบสุภาพ กระชับ เป็นภาษาไทย ไม่เกิน 3 ประโยค\n\nคำถาม: ${userText}`
        }]
      }],
      generationConfig: {
        maxOutputTokens: 300,
        temperature: 0.7
      }
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 8000
    });

    return response.data?.candidates?.[0]?.content?.parts?.[0]?.text
      || 'ขออภัยครับ ผมไม่เข้าใจคำถามนี้ รบกวนลองอีกครั้งครับ';

  } catch (err) {
    console.error('AI ERROR:', err.response?.data || err.message);
    return 'ขออภัย ระบบ AI ขัดข้องชั่วคราวครับ';
  }
}

// ── Flex Messages ─────────────────────────────────────────
function welcome() {
  return {
    type: 'flex', altText: 'สวัสดีครับ Innovation Link',
    contents: {
      type: 'bubble',
      body: {
        type: 'box', layout: 'vertical', paddingAll: '0px',
        contents: [
          {
            type: 'box', layout: 'vertical', backgroundColor: '#7b1a1a', paddingAll: '20px',
            contents: [
              { type: 'text', text: 'INNOVATION LINK', weight: 'bold', size: 'lg', color: '#ffffff' },
              { type: 'text', text: 'COMPANY LIMITED', size: 'xs', color: '#f0d898', margin: 'xs' },
              { type: 'text', text: 'ยินดีให้บริการครับ', size: 'sm', color: '#f0c8c8', margin: 'md' },
            ]
          },
          {
            type: 'box', layout: 'vertical', paddingAll: '16px', spacing: 'md',
            contents: [
              { type: 'box', layout: 'horizontal', spacing: 'md', contents: [
                { type: 'text', text: '📦', size: 'xl', flex: 1, align: 'center' },
                { type: 'box', layout: 'vertical', flex: 5, contents: [
                  { type: 'text', text: 'พิมพ์ "รายการสินค้า"', weight: 'bold', size: 'sm', color: '#2c1810' },
                  { type: 'text', text: 'ดูสินค้าและราคาทั้งหมด', size: 'xs', color: '#7a6860' },
                ]}
              ]},
              { type: 'separator' },
              { type: 'box', layout: 'horizontal', spacing: 'md', contents: [
                { type: 'text', text: '📄', size: 'xl', flex: 1, align: 'center' },
                { type: 'box', layout: 'vertical', flex: 5, contents: [
                  { type: 'text', text: 'พิมพ์ "เอกสาร"', weight: 'bold', size: 'sm', color: '#2c1810' },
                  { type: 'text', text: 'ออกใบเสนอราคา / ใบเสร็จ', size: 'xs', color: '#7a6860' },
                ]}
              ]},
            ]
          }
        ]
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '12px',
        contents: [{ type: 'button', style: 'primary', color: '#c4973b',
          action: { type: 'uri', label: 'เปิดแอปสร้างรายการ', uri: LIFF_URL } }]
      }
    }
  };
}

function productCarousel() {
  const bubbles = PRODUCTS.map(p => ({
    type: 'bubble', size: 'micro',
    header: {
      type: 'box', layout: 'vertical', paddingAll: '12px', backgroundColor: '#7b1a1a',
      contents: [{ type: 'text', text: p.name, weight: 'bold', size: 'sm', color: '#ffffff', wrap: true }]
    },
    body: {
      type: 'box', layout: 'vertical', paddingAll: '12px', spacing: 'sm',
      contents: [
        { type: 'box', layout: 'baseline', spacing: 'sm', contents: [
          { type: 'text', text: 'ราคา', size: 'xs', color: '#7a6860', flex: 2 },
          { type: 'text', text: `${p.price.toLocaleString()} บาท`, size: 'sm', color: '#7b1a1a', weight: 'bold', flex: 3, align: 'end' },
        ]},
        { type: 'box', layout: 'baseline', spacing: 'sm', contents: [
          { type: 'text', text: 'หน่วย', size: 'xs', color: '#7a6860', flex: 2 },
          { type: 'text', text: p.unit, size: 'sm', color: '#2c1810', flex: 3, align: 'end' },
        ]},
      ]
    },
    footer: {
      type: 'box', layout: 'vertical', paddingAll: '8px',
      contents: [{ type: 'button', style: 'primary', color: '#c4973b', height: 'sm',
        action: { type: 'uri', label: 'สั่งซื้อ', uri: LIFF_URL } }]
    }
  }));
  return {
    type: 'flex',
    altText: `รายการสินค้า Innovation Link (${PRODUCTS.length} รายการ)`,
    contents: { type: 'carousel', contents: bubbles }
  };
}

function docMenu() {
  return {
    type: 'flex', altText: 'เลือกประเภทเอกสาร',
    contents: {
      type: 'bubble',
      header: {
        type: 'box', layout: 'vertical', paddingAll: '16px', backgroundColor: '#7b1a1a',
        contents: [
          { type: 'text', text: 'ออกเอกสาร', weight: 'bold', size: 'lg', color: '#ffffff' },
          { type: 'text', text: 'เลือกประเภทเอกสารที่ต้องการ', size: 'sm', color: '#f0c8c8', margin: 'xs' },
        ]
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '16px',
        contents: [
          { type: 'box', layout: 'horizontal', spacing: 'md', paddingAll: '12px',
            backgroundColor: '#f8f0f0', cornerRadius: '8px',
            action: { type: 'uri', label: 'ใบเสนอราคา', uri: LIFF_URL },
            contents: [
              { type: 'text', text: '📋', size: 'xxl', flex: 1, align: 'center' },
              { type: 'box', layout: 'vertical', flex: 4, contents: [
                { type: 'text', text: 'ใบเสนอราคา', weight: 'bold', size: 'md', color: '#7b1a1a' },
                { type: 'text', text: 'Quotation', size: 'xs', color: '#7a6860' },
              ]}
            ]
          },
          { type: 'box', layout: 'horizontal', spacing: 'md', paddingAll: '12px',
            backgroundColor: '#fbf4e4', cornerRadius: '8px',
            action: { type: 'uri', label: 'ใบเสร็จ', uri: LIFF_URL },
            contents: [
              { type: 'text', text: '🧾', size: 'xxl', flex: 1, align: 'center' },
              { type: 'box', layout: 'vertical', flex: 4, contents: [
                { type: 'text', text: 'ใบเสร็จรับเงิน', weight: 'bold', size: 'md', color: '#9a7020' },
                { type: 'text', text: 'Receipt', size: 'xs', color: '#7a6860' },
              ]}
            ]
          },
        ]
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '12px',
        contents: [{ type: 'button', style: 'secondary',
          action: { type: 'uri', label: 'เปิดแอปกรอกข้อมูล', uri: LIFF_URL } }]
      }
    }
  };
}

// ── Reply Helper ──────────────────────────────────────────
function replyMsg(replyToken, message) {
  const body = JSON.stringify({ replyToken, messages: [message] });
  console.log('Sending reply, token:', replyToken?.substring(0, 20) + '...');
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.line.me', path: '/v2/bot/message/reply', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Length': Buffer.byteLength(body),
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode !== 200) console.error(`LINE API error ${res.statusCode}:`, data);
        else console.log('Reply sent successfully');
        resolve();
      });
    });
    req.on('error', err => { console.error('Request error:', err); reject(err); });
    req.write(body);
    req.end();
  });
}

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚀 Webhook running on port ${port}`));