# limit-charter-count-hook
This is a custom Directus hook to force a limit of skaters.

The default is 20 skaters.
It's customizable through a variable located in a directus singleton collection name `options` which contains a `char_max_count` integer field.
