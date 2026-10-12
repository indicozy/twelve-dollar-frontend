<?php

// Merged over the framework's config/view.php. The compiled Blade views are built into the image
// (`php artisan view:cache`) and the code never changes in a running container, so don't stat() each view's source
// and compiled file on every render to see whether it needs recompiling (Octane resets the view engine per request,
// so the "already checked" memo doesn't survive between requests).
return [
    'check_cache_timestamps' => false,
];
