/* Types for the slots that unmigrated screens still attach onto LLD at runtime. They exist only so a migrated reader can
   use a slot while its owner is unmigrated. When jobs.ts and home.ts publish named exports, delete this file and the
   optional members on LLDRuntime. */

/** L.jobkit, defined in screens/jobs/jobs.ts. */

/** LLD.ui, defined in ui/select.ts and re-attached by legacy-bridge.ts. No reader exists today. */
