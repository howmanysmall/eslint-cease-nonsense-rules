#!/usr/bin/env fish

cd documentation/src/content/docs/rules

for file in *.mdx
	# If file is not staged, continue.
	if not git diff --cached --quiet -- "$file"
		to-tsx --convert-astro $file $file
	end
end