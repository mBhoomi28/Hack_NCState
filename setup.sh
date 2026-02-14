#!/bin/bash

# AI Image Detector - Quick Setup Script

echo "🤖 AI Image Detector - Setup Script"
echo "===================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js found: $(node --version)"
echo ""

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed!"
    exit 1
fi

echo "✅ npm found: $(npm --version)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully!"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "⚠️  IMPORTANT: Edit the .env file and add your Hive AI API key!"
    echo ""
fi

# Create icons directory if it doesn't exist
if [ ! -d icons ]; then
    echo "📁 Creating icons directory..."
    mkdir icons
    echo "⚠️  Remember to add icon files: icon16.png, icon48.png, icon128.png"
    echo ""
fi

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env and add your HIVE_API_KEY"
echo "2. Add icon files to the icons/ folder"
echo "3. Run 'npm start' to start the server"
echo "4. Load the extension in Chrome (chrome://extensions/)"
echo ""
echo "For detailed instructions, see README.md"
echo ""