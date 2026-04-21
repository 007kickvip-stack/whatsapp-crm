CREATE TABLE `field_permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`role` varchar(32) NOT NULL,
	`fieldKey` varchar(64) NOT NULL,
	`permission` varchar(32) NOT NULL DEFAULT 'editable',
	`updatedById` int,
	`updatedByName` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `field_permissions_id` PRIMARY KEY(`id`)
);
