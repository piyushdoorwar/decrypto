# 🔐 Decrypto - Strategic Word Cipher Game

A real-time multiplayer word cipher game built with **PartyKit** for 4 players. Encrypt codes, decode clues, and outsmart your opponents in this strategic team-based game!

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## 🎮 What is Decrypto?

Decrypto is a strategic communication game where two teams compete to intercept each other's secret codes while protecting their own. Players must give clever clues to help teammates decode messages without revealing too much to opponents.

### Key Features

- 🌐 **Real-time Multiplayer** - Room-based gameplay with WebSocket connections via PartyKit
- 🎨 **Custom Avatars** - Choose from 8 thematic icons or upload your own image
- 💬 **Toast Notifications** - Elegant, non-intrusive feedback system (no alert boxes!)
- 🎯 **Interactive Help** - Built-in game instructions in a beautiful modal
- 📱 **Responsive Design** - Works seamlessly on desktop and mobile
- 🎭 **Team-Based Strategy** - 2v2 gameplay with asymmetric information
- 🔒 **Persistent Storage** - Your name, avatar, and room preferences are saved locally

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd decrypto

# Install dependencies (if using PartyKit server)
cd decrypto-rooms
npm install

# Start development server
npx partykit dev
```

### Running Locally

1. **Option A: Simple HTTP Server**
   ```bash
   # From the root directory
   cd decrypto
   python -m http.server 8000
   # Open http://localhost:8000
   ```

2. **Option B: With PartyKit Backend**
   ```bash
   # Terminal 1: Start PartyKit server
   cd decrypto-rooms
   npx partykit dev
   
   # Terminal 2: Serve frontend
   cd decrypto
   python -m http.server 8000
   ```

3. Update `app.js` to point to your PartyKit instance:
   ```javascript
   const PARTY_URL = "localhost:1999"; // for local dev
   // or
   const PARTY_URL = "your-project.username.partykit.dev"; // for deployed
   ```

## 🎯 How to Play

### Setup (4 Players Required)

1. **Create a Room** - Host creates a room with a unique code
2. **Join Room** - 3 other players join using the room code
3. **Pick Words** - Each team selects 4 secret words
4. **Create Mapping** - Teams map their words to digits 1-4 (kept secret!)

### Gameplay Loop

Each round consists of:

1. **🔐 Encrypt** - The encryptor creates a 3-digit code (e.g., "3-1-2")
2. **💡 Clue** - The encryptor gives 3 single-word clues matching their code
3. **🤔 Decode** - Teammates try to guess the correct 3-digit code
4. **🎯 Intercept** - Opponents attempt to intercept the code

### Winning

- **Internal Points**: Your team decodes correctly
- **Interception Points**: You decode the enemy's code (+1 point)
- **Victory**: First team to **2 interceptions** wins!

### Rules

- ✅ Clues must be **single words** (no spaces)
- ✅ Codes use only digits **1-4**
- ✅ Can't reuse clues for the same word
- ✅ All digits (1-4) must appear at least once every 2 rounds

## 🛠 Tech Stack

### Frontend
- **Vanilla JavaScript** - No frameworks, pure ES6+
- **CSS3** - Modern gradients, animations, and glassmorphism
- **PartySocket** - WebSocket client for real-time communication

### Backend (PartyKit)
- **TypeScript** - Type-safe server logic
- **PartyKit** - Serverless WebSocket infrastructure
- **Cloudflare Workers** - Edge deployment

### Key Features Implementation

- **Toast System** - Custom notification library with 4 variants (success, error, warning, info)
- **Modal System** - Reusable overlay for instructions and dialogs
- **Image Upload** - Base64 encoding for custom avatars (500KB limit)
- **Local Storage** - Persistent player identity and preferences
- **Responsive Grid** - CSS Grid and Flexbox for adaptive layouts

## 📁 Project Structure

```
decrypto/
├── app.js              # Main game logic and UI
├── styles.css          # Complete styling with animations
├── index.html          # Entry point
├── favicon.svg         # Custom SVG favicon
└── README.md           # This file

decrypto-rooms/         # PartyKit server (optional)
├── party/
│   └── index.ts        # Server-side game logic
├── package.json
├── partykit.json       # PartyKit configuration
└── tsconfig.json
```

## 🎨 UI/UX Features

### Design Philosophy
- **Classy Dark Theme** - Deep blues and purples with subtle gradients
- **Smooth Animations** - 60fps transitions and hover effects
- **Visual Feedback** - Every interaction has clear visual response
- **Accessible** - Keyboard navigation and ARIA labels

### Custom Icons
Choose from 8 professionally designed SVG icons:
- 👑 Crown - Royal leadership
- 🧙 Wizard - Magical strategy
- 🛡️ Shield - Defensive mastery
- 🐉 Dragon - Fierce competitor
- 🔥 Phoenix - Rising champion
- 🏰 Castle - Strategic fortress
- 🧭 Compass - Navigator
- ⚔️ Sword - Tactical warrior

### Toast Notifications
Non-blocking, elegant notifications with:
- Color-coded by type (green/red/yellow/blue)
- Auto-dismiss after 3 seconds
- Smooth slide-in animations
- Glassmorphism backdrop blur
- Stacking support for multiple toasts

## 🚢 Deployment

### Deploy to PartyKit

```bash
cd decrypto-rooms
npx partykit deploy
```

Your PartyKit server will be deployed to:
```
https://your-project.your-username.partykit.dev
```

### Update Frontend

Update the `PARTY_URL` in `app.js`:
```javascript
const PARTY_URL = "your-project.your-username.partykit.dev";
```

### Host Frontend

Deploy the frontend to any static hosting:
- **GitHub Pages** - Free and easy
- **Netlify** - Drag & drop deployment
- **Vercel** - Automatic deployments from Git
- **Cloudflare Pages** - Edge hosting

## 🔧 Configuration

### Customization Options

**Word Pool** (in `party/index.ts`):
```typescript
const WORD_POOL = [
  "Anchor", "Mirror", "Battery", // ... add your words
];
```

**Game Settings**:
- `INTERCEPTIONS_TO_WIN`: Default 2
- `REQUIRED_PLAYERS`: Default 4
- `IMAGE_SIZE_LIMIT`: Default 500KB

**Styling** (in `styles.css`):
```css
:root {
  --bg: #0b0d10;
  --accent: #7aa2ff;
  --good: #3ddc97;
  /* ... customize colors */
}
```

## 🐛 Troubleshooting

### WebSocket Connection Failed

**Problem**: Toast shows "WebSocket connection failed"

**Solutions**:
1. Check `PARTY_URL` in `app.js` matches your deployment
2. Ensure PartyKit server is running (`npx partykit dev`)
3. Verify `party` name in `app.js` matches `partykit.json`

### Custom Avatar Not Showing

**Problem**: Uploaded image doesn't appear

**Solutions**:
1. Image must be < 500KB
2. Only image formats supported (jpg, png, gif, webp)
3. Check browser console for errors
4. Clear localStorage and try again

### Players Can't Join Room

**Problem**: Room code doesn't work

**Solutions**:
1. Room codes are case-sensitive
2. Ensure all players use the exact same code
3. Check that backend server is accessible
4. Try creating a new room

## 📝 License

MIT License - feel free to use this project for learning or building your own games!

## 🙏 Credits

- Original board game concept by **Thomas Dagenais-Lespérance**
- Built with [PartyKit](https://partykit.io)
- Icons designed in-house with SVG
- Toast system inspired by modern design systems

## 🤝 Contributing

Contributions are welcome! Areas for improvement:

- [ ] Add spectator mode
- [ ] Implement replay system
- [ ] Add sound effects
- [ ] Create tournament mode
- [ ] Add game statistics/history
- [ ] Internationalization (i18n)

## 📧 Support

Found a bug or have a question? Open an issue on GitHub!

---

**Made with ❤️ and ☕ for strategy game enthusiasts**

Enjoy playing Decrypto! 🎮🔐
