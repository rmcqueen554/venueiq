# 15 PostgreSQL databases — one per microservice
# Uses TimescaleDB-compatible Postgres 16

locals {
  services = [
    "tenants", "executive", "concessions", "merchandise", "ticketing",
    "sponsorship", "operations", "facilities", "security", "parking",
    "fans", "agents", "nlq", "automation", "reporting"
  ]
}

resource "aws_db_subnet_group" "venueiq" {
  name       = "${var.app_name}-db-subnet-group"
  subnet_ids = module.vpc.private_subnets
}

resource "aws_security_group" "rds" {
  name   = "${var.app_name}-rds-sg"
  vpc_id = module.vpc.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [module.eks.node_security_group_id]
  }
}

resource "aws_db_instance" "venueiq" {
  for_each = toset(local.services)

  identifier             = "${var.app_name}-${each.key}-${var.environment}"
  engine                 = "postgres"
  engine_version         = "16.3"
  instance_class         = "db.t4g.medium"
  allocated_storage      = 50
  max_allocated_storage  = 500
  storage_type           = "gp3"
  storage_encrypted      = true

  db_name  = "venueiq_${each.key}"
  username = "venueiq"
  password = random_password.db_passwords[each.key].result

  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.venueiq.name

  multi_az               = true
  publicly_accessible    = false
  deletion_protection    = true
  skip_final_snapshot    = false
  final_snapshot_identifier = "${var.app_name}-${each.key}-final"

  backup_retention_period = 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"

  performance_insights_enabled = true
  monitoring_interval          = 60
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  tags = { Service = each.key }
}

resource "random_password" "db_passwords" {
  for_each = toset(local.services)
  length   = 32
  special  = false
}

resource "aws_secretsmanager_secret" "db_credentials" {
  for_each = toset(local.services)
  name     = "${var.app_name}/${var.environment}/db/${each.key}"
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  for_each  = toset(local.services)
  secret_id = aws_secretsmanager_secret.db_credentials[each.key].id
  secret_string = jsonencode({
    username = "venueiq"
    password = random_password.db_passwords[each.key].result
    host     = aws_db_instance.venueiq[each.key].address
    port     = 5432
    dbname   = "venueiq_${each.key}"
    url      = "postgresql://venueiq:${random_password.db_passwords[each.key].result}@${aws_db_instance.venueiq[each.key].address}:5432/venueiq_${each.key}"
  })
}
