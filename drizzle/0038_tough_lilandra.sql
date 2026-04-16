ALTER TABLE `users` ADD `employmentStatus` enum('probation','regular') DEFAULT 'regular' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `probationBaseSalary` decimal(12,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `users` ADD `regularBaseSalary` decimal(12,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `users` ADD `regularDate` date;