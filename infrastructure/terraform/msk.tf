# AWS MSK (Managed Kafka) for VenueIQ event streaming
resource "aws_msk_cluster" "venueiq" {
  cluster_name           = "${var.app_name}-${var.environment}"
  kafka_version          = "3.6.0"
  number_of_broker_nodes = 3

  broker_node_group_info {
    instance_type   = "kafka.m5.xlarge"
    client_subnets  = module.vpc.private_subnets
    storage_info {
      ebs_storage_info { volume_size = 500 }
    }
    security_groups = [aws_security_group.msk.id]
  }

  encryption_info {
    encryption_in_transit { client_broker = "TLS" }
  }

  client_authentication {
    sasl { scram = true }
  }

  configuration_info {
    arn      = aws_msk_configuration.venueiq.arn
    revision = aws_msk_configuration.venueiq.latest_revision
  }
}

resource "aws_msk_configuration" "venueiq" {
  name              = "${var.app_name}-${var.environment}-config"
  kafka_versions    = ["3.6.0"]
  server_properties = <<PROPS
auto.create.topics.enable=true
default.replication.factor=3
min.insync.replicas=2
num.partitions=12
log.retention.hours=168
message.max.bytes=10485760
PROPS
}

resource "aws_security_group" "msk" {
  name   = "${var.app_name}-msk-sg"
  vpc_id = module.vpc.vpc_id

  ingress {
    from_port       = 9096
    to_port         = 9096
    protocol        = "tcp"
    security_groups = [module.eks.node_security_group_id]
  }
}
