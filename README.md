# Jump to link
WebExtension for easier keyboard navigation on pages with lots of links.

## Browser support
Firefox, Chrome.
This is an experimental toy project and contains lots of bugs.

## What does it do?

Use <kbd>CTRL</kbd>+<kbd>SHIFT</kbd>+<kbd>SPACE</kbd> to open a special search bar, searching only the visible links and buttons on the current page.
Use <kbd>TAB</kbd> to cycle through the links (focus must remain inside search bar). <kbd>F3</kbd> is also possible, but not useful as it will also open the native search bar.

Use <kbd>ENTER</kbd> to visit the currently highlighted link. 
Close the search bar using <kbd>CTRL</kbd>+<kbd>SHIFT</kbd>+<kbd>SPACE</kbd> or <kbd>ESCAPE</kbd>.

If the corresponding option is set, only results inside the current viewport are shown, and elements that are covered in the stacking context should be excluded.

## Problems:
* iframes cannot be searched
* only links with a `href` attribute and `<button>` tags are searched.
* If search is not restricted to the current viewport, invisible elements that are covered by other elements may be included in the results.
* Performance is not optimized. No significant load should occur when search bar is not open.
* Bugs may occur on pages with heavy layout shifts, or many sticky, fixed or absolutely positioned elements
* Bugs may occur when content is updated, resized or removed via JS
* Bugs may occur when toggling option "restrict to viewport", and when scrolling while said option is enabled

Most bugs can be worked around by hitting `TAB` or closing/reopening the search bar.

