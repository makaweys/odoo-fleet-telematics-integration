#!/bin/bash

# Setup Script - Make all test scripts executable

echo "🔧 Setting up Vehicle Telematics Tracker Test Scripts"
echo "====================================================="

# Make all shell scripts executable
chmod +x *.sh

echo "Made executable:"
echo "- quick-test.sh"
echo "- api-tests.sh"
echo "- odoo-automation-examples.sh"
echo "- setup.sh"

echo ""
echo "Setup complete!"
echo ""
echo "Usage:"
echo "./quick-test.sh              # Quick health check"
echo "./api-tests.sh --all         # Comprehensive tests"
echo "./api-tests.sh --vehicles    # Test vehicle APIs"
echo "./api-tests.sh --odoo        # Test Odoo integration"
echo "./odoo-automation-examples.sh # Odoo automation examples"
echo ""
echo "Port detection:"
echo "Scripts auto-detect port from .env file"
echo "or use --port=4308 to specify manually"
echo "====================================================="