#!/bin/bash
# Preview the site locally at http://localhost:4000
#
# First-time setup:
#   /opt/homebrew/opt/ruby/bin/gem install jekyll minima webrick \
#     jekyll-optional-front-matter jekyll-titles-from-headings jekyll-default-layout

set -e

RUBY=/opt/homebrew/opt/ruby/bin/ruby

if ! "$RUBY" -e "gem 'jekyll', '~> 4.3'" 2>/dev/null; then
  echo "Jekyll not found. Run:"
  echo "  /opt/homebrew/opt/ruby/bin/gem install jekyll minima webrick \\"
  echo "    jekyll-optional-front-matter jekyll-titles-from-headings jekyll-default-layout"
  exit 1
fi

# Kill any running Jekyll server first
pkill -f 'jekyll.*serve' 2>/dev/null && echo "Stopped existing Jekyll server." || true

echo "Starting Jekyll — http://localhost:4000"
"$RUBY" -e "gem 'jekyll', '~> 4.3'; load Gem.bin_path('jekyll', 'jekyll')" \
  -- serve --livereload --open-url 2>&1 | grep -v "DEPRECATION WARNING"
