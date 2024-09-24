## Challenges to address (as of 2.1.14):

- the initial notifications "Custom sorting ON" and "Parsing custom sorting specification SUCCEEDED!" 
  don't reflect the actual state in some cases - the custom sorting is not applied
- the notifications are shown more than once in some cases
- when the File Explorer is not visible on start (1.7.2 and the lazy views) it is not possible to auto-apply custom sort
  and attempting to do so ends up with an error
- there are more challenges when attempting to apply the custom sorting automatically on start

An idea of solution, not ideal, but acceptable at glance:
- simplify the logic of notifications - only show when successful
- introduce a new popup "Custom sorting was not applied automatically, apply now?"
  - only when it was enabled, only when the File Explorer view is visible
  - allow to disable this popup in settings (or via a checkbox "don't show it again")
- introduce a new popup "File Explorer view is not visible, cannot apply custom sort"
  - only when the user explicitly attempts to apply custom sort 

Additional remarks:
- [Brian Ray](https://github.com/bray) mentions a Lazy Plugin loader in #163
  - check it out and make sure it works correctly (gracefully, not necessarily auto-apply custom sort) 
- in some rare cases the custom sorting can be applied successfully on start
  - keep this scenario handled correctly
  - see #161 for the sequence of events (a) -> (f)

## References:

#163: Obsidian 1.7.2 - automatic sorting fails when launching Obsidian
[#163](https://github.com/SebastianMC/obsidian-custom-sort/issues/163)

#162: Obsidian 1.7.2 breaking changes - when File Explorer is not displayed an attempt to apply custom sort fails with error
[#162](https://github.com/SebastianMC/obsidian-custom-sort/issues/162)

#161: Find out how to automatically apply custom sort on app start / vault (re)load etc.
[#161](https://github.com/SebastianMC/obsidian-custom-sort/issues/161)

## Design

0. Before all, capture the sequences of key execution points and events (related to #161)

1. Fine-grained recognition of states of involved elements:
  - non-epmty sorting spec present or not?
  - sorting spec parsed successfully, hence ready to be applied?
  - File Explorer view available?
    - patchable?
    - lazy view?
  - plugin load time?
  - ...
