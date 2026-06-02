resource "aws_redshiftserverless_namespace" "venueiq" {
  namespace_name      = "${var.app_name}-${var.environment}"
  db_name             = "venueiq_warehouse"
  admin_username      = "venueiq_admin"
  admin_user_password = random_password.redshift_password.result
  manage_admin_password = false
  iam_roles           = [aws_iam_role.redshift.arn]
}

resource "aws_redshiftserverless_workgroup" "venueiq" {
  namespace_name = aws_redshiftserverless_namespace.venueiq.namespace_name
  workgroup_name = "${var.app_name}-${var.environment}"
  base_capacity  = 32  # RPUs
  publicly_accessible = false
  subnet_ids     = module.vpc.private_subnets
  security_group_ids = [aws_security_group.redshift.id]
}

resource "aws_security_group" "redshift" {
  name   = "${var.app_name}-redshift-sg"
  vpc_id = module.vpc.vpc_id
  ingress {
    from_port       = 5439
    to_port         = 5439
    protocol        = "tcp"
    security_groups = [module.eks.node_security_group_id]
  }
}

resource "aws_iam_role" "redshift" {
  name = "${var.app_name}-redshift-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{ Action = "sts:AssumeRole", Effect = "Allow", Principal = { Service = "redshift-serverless.amazonaws.com" } }]
  })
}

resource "random_password" "redshift_password" {
  length  = 32
  special = false
}
