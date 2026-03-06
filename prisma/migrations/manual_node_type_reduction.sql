UPDATE Node SET type = 'planning' WHERE type IN ('idea', 'decision', 'milestone', 'note');
UPDATE Node SET type = 'feature' WHERE type = 'task';
