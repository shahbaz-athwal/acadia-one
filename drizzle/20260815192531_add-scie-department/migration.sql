INSERT INTO `departments` (`prefix`, `name`, `facultyUrl`)
VALUES (
	'SCIE',
	'Faculty of Science',
	'https://science.acadiau.ca/links-for-faculty-staff.html'
)
ON CONFLICT(`prefix`) DO UPDATE SET
	`name` = excluded.`name`,
	`facultyUrl` = excluded.`facultyUrl`;
