ALTER TABLE `order_items` ADD `logisticsStatus` varchar(32) DEFAULT 'unknown';--> statement-breakpoint
ALTER TABLE `order_items` ADD `logisticsStatusText` varchar(64);--> statement-breakpoint
ALTER TABLE `order_items` ADD `logisticsLastUpdate` timestamp;--> statement-breakpoint
ALTER TABLE `order_items` ADD `logisticsSubscribed` int DEFAULT 0;