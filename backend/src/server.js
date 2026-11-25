import 'dotenv/config';
import { createApp } from './app.js';

const PORT = Number(process.env.PORT || 3001);
const app = createApp();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`YT Bento backend listening on http://localhost:${PORT}`);
});
