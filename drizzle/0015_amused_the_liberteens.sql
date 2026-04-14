ALTER TABLE `customers` ADD `customerTier` varchar(32);--> statement-breakpoint
ALTER TABLE `orders` ADD `customerName` varchar(128);--> statement-breakpoint
ALTER TABLE `orders` ADD `customerCountry` varchar(64);--> statement-breakpoint
ALTER TABLE `orders` ADD `customerTier` varchar(32);--> statement-breakpoint
ALTER TABLE `orders` ADD `customerLevel` varchar(32);--> statement-breakpoint
ALTER TABLE `orders` ADD `orderCategory` varchar(255);--> statement-breakpoint
ALTER TABLE `orders` ADD `customerBirthDate` date;--> statement-breakpoint
ALTER TABLE `orders` ADD `customerEmail` varchar(320);