resource "aws_s3_bucket" "reports" {
  bucket = "${var.app_name}-reports-${var.environment}"
}
resource "aws_s3_bucket" "uploads" {
  bucket = "${var.app_name}-uploads-${var.environment}"
}
resource "aws_s3_bucket" "ml_data" {
  bucket = "${var.app_name}-ml-data-${var.environment}"
}

resource "aws_s3_bucket_versioning" "all" {
  for_each = {
    reports = aws_s3_bucket.reports.id
    uploads = aws_s3_bucket.uploads.id
    ml_data = aws_s3_bucket.ml_data.id
  }
  bucket = each.value
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "all" {
  for_each = {
    reports = aws_s3_bucket.reports.id
    uploads = aws_s3_bucket.uploads.id
    ml_data = aws_s3_bucket.ml_data.id
  }
  bucket = each.value
  rule { apply_server_side_encryption_by_default { sse_algorithm = "AES256" } }
}

resource "aws_s3_bucket_public_access_block" "all" {
  for_each = {
    reports = aws_s3_bucket.reports.id
    uploads = aws_s3_bucket.uploads.id
    ml_data = aws_s3_bucket.ml_data.id
  }
  bucket                  = each.value
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_elasticache_cluster" "venueiq" {
  cluster_id           = "${var.app_name}-${var.environment}"
  engine               = "redis"
  node_type            = "cache.r7g.large"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379
  security_group_ids   = [aws_security_group.redis.id]
  subnet_group_name    = aws_elasticache_subnet_group.venueiq.name
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  snapshot_retention_limit   = 5
}

resource "aws_elasticache_subnet_group" "venueiq" {
  name       = "${var.app_name}-redis-subnet-group"
  subnet_ids = module.vpc.private_subnets
}

resource "aws_security_group" "redis" {
  name   = "${var.app_name}-redis-sg"
  vpc_id = module.vpc.vpc_id
  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [module.eks.node_security_group_id]
  }
}
