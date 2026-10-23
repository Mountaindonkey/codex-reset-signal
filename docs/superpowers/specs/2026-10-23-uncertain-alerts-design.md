# Broad, uncertain Tibo alerts

The user prefers receiving a possibly related original post over missing an announcement. Existing reset parsing requires the literal word `reset` and drops timing-only replies such as `Lands tomorrow before 10am PST.`

Keep confirmed reset/bank parsing unchanged. For posts without `reset`, recognize broad English/Chinese timing, quota, and rollout hints and return an uncertain `mention`. Existing notification delivery sends the complete original text and canonical URL; its uncertain label must make clear this is a possible signal, not a confirmed reset.

Approaches considered: widening the existing local filter (selected from the user's explicit request; no additional credentials or cost); notifying every post (unnecessary noise); using an external model (new credentials and cost unnecessary for the requested fallback).

Existing `INCLUDE_MENTIONS=false`, bootstrap-history suppression, deduplication, retry, and public RSS behavior stay in place. This change addresses filtering, not GitHub scheduler reliability. Existing historical posts will not be replayed automatically.

Success means timing-only posts reach the email delivery adapter once, retain the original text/link, and remain explicitly uncertain. Ordinary unrelated posts still do not trigger an alert.
